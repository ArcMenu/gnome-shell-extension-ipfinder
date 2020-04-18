/*
 * IP-Finder GNOME Extension by ArcMenu Team
 * https://gitlab.com/arcmenu-team/IP-Finder
 * 
 * ArcMenu Team
 * Andrew Zaech https://gitlab.com/AndrewZaech
 * LinxGem33 (Andy C) https://gitlab.com/LinxGem33
 * 
 * Find more from ArcMenu Team at
 * https://gitlab.com/arcmenu-team 
 * https://github.com/ArcMenu
 *
 *
 * This file is borrowed from GNOME shell https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/status/network.js
 * and slightly modified to suit this projects needs
 * 
 * IP Finder gnome extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * IP Finder gnome extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with IP Finder gnome extension.  If not, see <http://www.gnu.org/licenses/>.
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Gio, GLib, NM } = imports.gi;
const Signals = imports.signals;
const Utils = Me.imports.utils;

const { loadInterfaceXML } = imports.misc.fileUtils;

const NMConnectionCategory = {
    INVALID: 'invalid',
    WIRED: 'wired',
    WIRELESS: 'wireless',
    WWAN: 'wwan',
    VPN: 'vpn',
};

const NMAccessPointSecurity = {
    NONE: 1,
    WEP: 2,
    WPA_PSK: 3,
    WPA2_PSK: 4,
    WPA_ENT: 5,
    WPA2_ENT: 6,
};

var MAX_DEVICE_ITEMS = 4;

// small optimization, to avoid using [] all the time
const NM80211Mode = NM['80211Mode'];
const NM80211ApFlags = NM['80211ApFlags'];
const NM80211ApSecurityFlags = NM['80211ApSecurityFlags'];

var PortalHelperResult = {
    CANCELLED: 0,
    COMPLETED: 1,
    RECHECK: 2,
};

const PortalHelperIface = loadInterfaceXML('org.gnome.Shell.PortalHelper');
const PortalHelperProxy = Gio.DBusProxy.makeProxyWrapper(PortalHelperIface);

function ensureActiveConnectionProps(active) {
    if (!active._primaryDevice) {
        let devices = active.get_devices();
        if (devices.length > 0) {
            // This list is guaranteed to have at most one device in it.
            let device = devices[0]._delegate;
            active._primaryDevice = device;
        }
    }
}

var NetworkManger = class IPFinder_NetworkManger{
    constructor() {
        // Device types
        this._dtypes = { };
        this._dtypes[NM.DeviceType.ETHERNET] = imports.ui.status.network.NMDeviceWired;
        this._dtypes[NM.DeviceType.WIFI] = imports.ui.status.network.NMDeviceWireless;
        this._dtypes[NM.DeviceType.MODEM] = imports.ui.status.network.NMDeviceModem;
        this._dtypes[NM.DeviceType.BT] = imports.ui.status.network.NMDeviceBluetooth;

        // Connection types
        this._ctypes = { };
        this._ctypes[NM.SETTING_WIRED_SETTING_NAME] = NMConnectionCategory.WIRED;
        this._ctypes[NM.SETTING_WIRELESS_SETTING_NAME] = NMConnectionCategory.WIRELESS;
        this._ctypes[NM.SETTING_BLUETOOTH_SETTING_NAME] = NMConnectionCategory.WWAN;
        this._ctypes[NM.SETTING_CDMA_SETTING_NAME] = NMConnectionCategory.WWAN;
        this._ctypes[NM.SETTING_GSM_SETTING_NAME] = NMConnectionCategory.WWAN;
        this._ctypes[NM.SETTING_VPN_SETTING_NAME] = NMConnectionCategory.VPN;
        NM.Client.new_async(null, this._clientGot.bind(this));
    }

    _clientGot(obj, result) {
        this._client = NM.Client.new_finish(result);
        this._activeConnections = [];
        this._connections = [];
        this._connectivityQueue = [];

        this._mainConnection = null;
        this._mainConnectionIconChangedId = 0;
        this._mainConnectionStateChangedId = 0;

        this._notification = null;

        this._nmDevices = [];
        this._devices = { };

        let categories = [NMConnectionCategory.WIRED,
                          NMConnectionCategory.WIRELESS,
                          NMConnectionCategory.WWAN];
        for (let category of categories) {
            this._devices[category] = new imports.ui.status.network.DeviceCategory(category);
        }

        this._vpnSection = new imports.ui.status.network.NMVpnSection(this._client);
        this._vpnSection.connect('activation-failed', this._onActivationFailed.bind(this));

        this._readConnections();
        this._readDevices();
        this._syncNMState();
        this._syncMainConnection();
        this._syncVpnConnections();

        this._client.connect('notify::nm-running', this._syncNMState.bind(this));
        this._client.connect('notify::networking-enabled', this._syncNMState.bind(this));
        this._client.connect('notify::state', this._syncNMState.bind(this));
        this._client.connect('notify::primary-connection', this._syncMainConnection.bind(this));
        this._client.connect('notify::activating-connection', this._syncMainConnection.bind(this));
        this._client.connect('notify::active-connections', this._syncVpnConnections.bind(this));
        this._client.connect('notify::connectivity', this._syncConnectivity.bind(this));
        this._client.connect('device-added', this._deviceAdded.bind(this));
        this._client.connect('device-removed', this._deviceRemoved.bind(this));
        this._client.connect('connection-added', this._connectionAdded.bind(this));
        this._client.connect('connection-removed', this._connectionRemoved.bind(this));
    }

    _readDevices() {
        let devices = this._client.get_devices() || [];
        for (let i = 0; i < devices.length; ++i) {
            try {
                this._deviceAdded(this._client, devices[i], true);
            } catch (e) {
                log('Failed to add device %s: %s'.format(devices[i], e.toString()));
            }
        }
        this._syncDeviceNames();
    }

    _onActivationFailed(_device, _reason) {
        // XXX: nm-applet has no special text depending on reason
        // but I'm not sure of this generic message
    }

    _syncDeviceNames() {
        let names = NM.Device.disambiguate_names(this._nmDevices);
        for (let i = 0; i < this._nmDevices.length; i++) {
            let device = this._nmDevices[i];
            let description = names[i];
            if (device._delegate)
                device._delegate.setDeviceDescription(description);
        }
    }

    _deviceAdded(client, device, skipSyncDeviceNames) {
        if (device._delegate) {
            // already seen, not adding again
            return;
        }

        let wrapperClass = this._dtypes[device.get_device_type()];
        if (wrapperClass) {
            let wrapper = new wrapperClass(this._client, device);
            device._delegate = wrapper;
            this._addDeviceWrapper(wrapper);

            this._nmDevices.push(device);
            this._deviceChanged(device, skipSyncDeviceNames);

            device.connect('notify::interface', () => {
                this._deviceChanged(device, false);
            });
        }
    }

    _deviceChanged(device, skipSyncDeviceNames) {
        let wrapper = device._delegate;

        if (!skipSyncDeviceNames)
            this._syncDeviceNames();

        if (wrapper instanceof imports.ui.status.network.NMConnectionSection) {
            this._connections.forEach(connection => {
                wrapper.checkConnection(connection);
            });
        }
    }

    _addDeviceWrapper(wrapper) {
        wrapper._activationFailedId = wrapper.connect('activation-failed',
                                                      this._onActivationFailed.bind(this));

        let section = this._devices[wrapper.category].section;
        section.addMenuItem(wrapper.item);

        let devices = this._devices[wrapper.category].devices;
        devices.push(wrapper);
    }

    _deviceRemoved(client, device) {
        let pos = this._nmDevices.indexOf(device);
        if (pos != -1) {
            this._nmDevices.splice(pos, 1);
            this._syncDeviceNames();
        }

        let wrapper = device._delegate;
        if (!wrapper) {
            log('Removing a network device that was not added');
            return;
        }

        this._removeDeviceWrapper(wrapper);
    }

    _removeDeviceWrapper(wrapper) {
        wrapper.disconnect(wrapper._activationFailedId);
        wrapper.destroy();

        let devices = this._devices[wrapper.category].devices;
        let pos = devices.indexOf(wrapper);
        devices.splice(pos, 1);
    }

    _getMainConnection() {
        let connection;

        connection = this._client.get_primary_connection();
        if (connection) {
            ensureActiveConnectionProps(connection);
            return connection;
        }

        connection = this._client.get_activating_connection();
        if (connection) {
            ensureActiveConnectionProps(connection);
            return connection;
        }

        return null;
    }

    _syncMainConnection() {
        if (this._mainConnectionIconChangedId > 0) {
            this._mainConnection._primaryDevice.disconnect(this._mainConnectionIconChangedId);
            this._mainConnectionIconChangedId = 0;
        }

        if (this._mainConnectionStateChangedId > 0) {
            this._mainConnection.disconnect(this._mainConnectionStateChangedId);
            this._mainConnectionStateChangedId = 0;
        }

        this._mainConnection = this._getMainConnection();

        if (this._mainConnection) {
            this._mainConnectionStateChangedId = this._mainConnection.connect('notify::state', this._mainConnectionStateChanged.bind(this));
            this._mainConnectionStateChanged();
        }

        this._syncConnectivity();
    }

    _syncVpnConnections() {
        let activeConnections = this._client.get_active_connections() || [];
        let vpnConnections = activeConnections.filter(
            a => a instanceof NM.VpnConnection
        );
        vpnConnections.forEach(a => {
            ensureActiveConnectionProps(a);
        });
        this._vpnSection.setActiveConnections(vpnConnections);

    }

    _mainConnectionStateChanged() {

    }

    _ignoreConnection(connection) {
        let setting = connection.get_setting_connection();
        if (!setting)
            return true;

        // Ignore slave connections
        if (setting.get_master())
            return true;

        return false;
    }

    _addConnection(connection) {
        if (this._ignoreConnection(connection))
            return;
        if (connection._updatedId) {
            // connection was already seen
            return;
        }

        connection._updatedId = connection.connect('changed', this._updateConnection.bind(this));

        this._updateConnection(connection);
        this._connections.push(connection);
    }

    _readConnections() {
        let connections = this._client.get_connections();
        connections.forEach(this._addConnection.bind(this));
    }

    _connectionAdded(client, connection) {
        this._addConnection(connection);
    }

    _connectionRemoved(client, connection) {
        let pos = this._connections.indexOf(connection);
        if (pos != -1)
            this._connections.splice(pos, 1);

        let section = connection._section;

        if (section == NMConnectionCategory.INVALID)
            return;

        if (section == NMConnectionCategory.VPN) {
            this._vpnSection.removeConnection(connection);
        } else {
            let devices = this._devices[section].devices;
            for (let i = 0; i < devices.length; i++) {
                if (devices[i] instanceof imports.ui.status.network.NMConnectionSection)
                    devices[i].removeConnection(connection);
            }
        }

        connection.disconnect(connection._updatedId);
        connection._updatedId = 0;
    }

    _updateConnection(connection) {
        let connectionSettings = connection.get_setting_by_name(NM.SETTING_CONNECTION_SETTING_NAME);
        connection._type = connectionSettings.type;
        connection._section = this._ctypes[connection._type] || NMConnectionCategory.INVALID;

        let section = connection._section;

        if (section == NMConnectionCategory.INVALID)
            return;

        if (section == NMConnectionCategory.VPN) {
            this._vpnSection.checkConnection(connection);
        } else {
            let devices = this._devices[section].devices;
            devices.forEach(wrapper => {
                if (wrapper instanceof imports.ui.status.network.NMConnectionSection)
                    wrapper.checkConnection(connection);
            });
        }
    }

    _syncNMState() {
        this.visible = this._client.nm_running;

        this._syncConnectivity();
    }

    _flushConnectivityQueue() {
        if (this._portalHelperProxy) {
            for (let item of this._connectivityQueue)
                this._portalHelperProxy.CloseRemote(item);
        }

        this._connectivityQueue = [];
    }

    _closeConnectivityCheck(path) {
        let index = this._connectivityQueue.indexOf(path);

        if (index >= 0) {
            if (this._portalHelperProxy)
                this._portalHelperProxy.CloseRemote(path);

            this._connectivityQueue.splice(index, 1);
        }
    }

    async _portalHelperDone(proxy, emitter, parameters) {
        let [path, result] = parameters;

        if (result == PortalHelperResult.CANCELLED) {
            // Keep the connection in the queue, so the user is not
            // spammed with more logins until we next flush the queue,
            // which will happen once he chooses a better connection
            // or we get to full connectivity through other means
        } else if (result == PortalHelperResult.COMPLETED) {
            this._closeConnectivityCheck(path);
        } else if (result == PortalHelperResult.RECHECK) {
            this._client.check_connectivity_async(null, (client, res) => {
                try {
                    let state = client.check_connectivity_finish(res);
                    if (state >= NM.ConnectivityState.FULL)
                        this._closeConnectivityCheck(path);
                } catch (e) { }
            });
        } else {
            log('Invalid result from portal helper: %s'.format(result));
        }
    }

    _syncConnectivity() {
        if (this._mainConnection == null ||
            this._mainConnection.state != NM.ActiveConnectionState.ACTIVATED) {
            this._flushConnectivityQueue();
            this.emit('no-connection');
            return;
        }

        this.emit('connection-changed');
        let isPortal = this._client.connectivity == NM.ConnectivityState.PORTAL;
        // For testing, allow interpreting any value != FULL as PORTAL, because
        // LIMITED (no upstream route after the default gateway) is easy to obtain
        // with a tethered phone
        // NONE is also possible, with a connection configured to force no default route
        // (but in general we should only prompt a portal if we know there is a portal)
        if (GLib.getenv('GNOME_SHELL_CONNECTIVITY_TEST') != null)
            isPortal = isPortal || this._client.connectivity < NM.ConnectivityState.FULL;
        if (!isPortal || Main.sessionMode.isGreeter)
            return;

        let path = this._mainConnection.get_path();
        for (let item of this._connectivityQueue) {
            if (item == path)
                return;
        }

        let timestamp = global.get_current_time();
        if (this._portalHelperProxy) {
            this._portalHelperProxy.AuthenticateRemote(path, '', timestamp);
        } else {
            new PortalHelperProxy(Gio.DBus.session, 'org.gnome.Shell.PortalHelper',
                                  '/org/gnome/Shell/PortalHelper', (proxy, error) => {
                                      if (error) {
                                          log('Error launching the portal helper: %s'.format(error));
                                          return;
                                      }

                                      this._portalHelperProxy = proxy;
                                      proxy.connectSignal('Done', this._portalHelperDone.bind(this));

                                      proxy.AuthenticateRemote(path, '', timestamp);
                                  });
        }

        this._connectivityQueue.push(path);
    }
}
Signals.addSignalMethods(NetworkManger.prototype);
