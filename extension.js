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
 * This file is part of IP Finder gnome extension.
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

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, Gio, GObject, NM, Soup, Shell, St} = imports.gi;
const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const ICON_SIZE = 16;

const SETTINGS_ACTORS_IN_PANEL = 'actors-in-panel';
const SETTINGS_POSITION = 'position-in-panel';
const SETTINGS_PANEL_VPN_ICONS = 'panel-vpn-icons';
const SETTINGS_PANEL_VPN_ICON_COLORS = 'panel-vpn-icon-colors';
const SETTINGS_PANEL_VPN_IP_ADDR_COLORS = 'panel-vpn-ip-addr-colors';

const DEFAULT_MAP_TILE = Me.path + '/icons/default_map.png';
const LATEST_MAP_TILE = Me.path + '/icons/latest_map.png';

const DEFAULT_DATA = {
    ip: { name: _("IP Address"), text: _("Loading IP Details")},
    hostname: { name: _("Hostname"), text: ''},
    city: { name: _("City"), text: ''},
    region: { name: _("Region"), text: ''},
    country: { name: _("Country"), text: ''},
    loc: { name: _("Location"), text: ''},
    org: { name: _("Org"), text: ''},
    postal: { name: _("Postal"), text: ''},
    timezone: { name: _("Timezone"), text: ''},
};

const PANEL_ACTORS = {
    Flag_IP: 0,
    Flag: 1,
    IP: 2,
}

var IPMenu = GObject.registerClass(class IPMenu_IPMenu extends PanelMenu.Button{
    _init() {
        super._init(0.5, _('IP Details'));
        this._textureCache = St.TextureCache.get_default();
        this._session = new Soup.Session({ user_agent : 'ip-finder/' + Me.metadata.version, timeout: 5 });
        this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
        this._connection = false;
        this._setPrefs();
        
        this.panelBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });

        this._icon = new St.Icon({
            icon_name: 'network-wired-acquiring-symbolic',
            icon_size: ICON_SIZE,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style: "padding-left: 5px; padding-top: 3px;"
        });

        this._vpnIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path +"/icons/vpn-off-symbolic.svg"),
            icon_size: ICON_SIZE,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: this._vpnColors ? "ip-info-vpn-off" : null,
            style: "padding-right: 5px;"
        });

        this.ipAddr = DEFAULT_DATA.ip.text;

        this._label = new St.Label({
            text: _(this.ipAddr),
            y_align: Clutter.ActorAlign.CENTER
        });

        this.panelBox.add_actor(this._label);
        this.panelBox.add_actor(this._icon);
        
        this.add_actor(this.panelBox);

        let ipInfo = new PopupMenu.PopupMenuSection();
        this.menu.box.style = "padding: 16px;";
        let parentContainer = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            style: "min-width:540px; padding-bottom: 10px;"
        }); 

        this._mapInfo = new St.BoxLayout({ 
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
        });
        parentContainer.add_actor(this._mapInfo);
        this._mapInfo.add_actor(this._getMapTile(DEFAULT_MAP_TILE));
        
        this.ipInfoBox = new St.BoxLayout({
            style_class: 'ip-info-box',
            vertical: true , 
            x_align: Clutter.ActorAlign.CENTER,
        });
        parentContainer.add_actor(this.ipInfoBox);
        ipInfo.actor.add(parentContainer);
        this.menu.addMenuItem(ipInfo);

        this.ipInfoMap = new Map();
        this.gettingIpInfo = false;
    
        let buttonBox = new St.BoxLayout();
        this._settingsIcon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._settingsButton = new St.Button({ 
            child: this._settingsIcon, 
            style_class: 'button' 
        });
        this._settingsButton.connect('clicked',  ()=> Util.spawnCommandLine('gnome-extensions prefs IP-Finder@linxgem33.com'));

        buttonBox.add_actor(this._settingsButton);

        this._copyIcon = new St.Icon({
            icon_name: 'edit-copy-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._copyButton = new St.Button({ 
            child: this._copyIcon,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'button' 
        });
        this._copyButton.connect('clicked',  ()=> {
            Clipboard.set_text(CLIPBOARD_TYPE, this.ipAddr);
        });
        buttonBox.add_actor(this._copyButton);

        this._refreshIcon = new St.Icon({
            icon_name: 'view-refresh-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._refreshButton = new St.Button({ 
            child: this._refreshIcon,
            x_expand: false,
            x_align: Clutter.ActorAlign.END,
            style_class: 'button' 
        });
        this._refreshButton.connect('clicked',  ()=> {
            //global.log("IP-Finder: Refresh Button Clicked - Updating IP Details...");
            this._getIpInfo(100);
        });
        buttonBox.add_actor(this._refreshButton);
        ipInfo.actor.add_actor(buttonBox);

        NM.Client.new_async(null, this.establishNetworkConnectivity.bind(this));

        this._settings.connect('changed', ()=> {
            this._setPrefs();
            this._resetPanelPos();
            this._showActorsInPanel();
            this._updatePanelStatus();
        });
        this._showActorsInPanel();
        Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);
    }

    establishNetworkConnectivity(obj, result){
        this._client = NM.Client.new_finish(result);
        this.activeConnectionsID = this._client.connect('notify::active-connections', () => {
            //global.log("IP-Finder: Network Connection Change Detected!");
            this._getIpInfo();
        });
        this._getIpInfo();
    }

    _getIpInfo(timeout = 2000){
        this._icon.show();
        this._label.text = _(DEFAULT_DATA.ip.text);
        this._label.style_class = null;
        this._icon.icon_name = 'network-wired-acquiring-symbolic';
        this._vpnIcon.style_class = null;
        if(this.panelBox.contains(this._vpnIcon))
            this.panelBox.remove_actor(this._vpnIcon);
        if(this._getIpInfoID){
            GLib.source_remove(this._getIpInfoID);
            this._getIpInfoID = null;
        }
        this._getIpInfoID = GLib.timeout_add(0, timeout, () => {
            this.vpnName = null;

            let activeConnections = this._client.get_active_connections() || [];
            let vpnConnections = activeConnections.filter(
                a => a.vpn || a.type === 'wireguard' || a.type === 'tun');
            vpnConnections.forEach(a => {
                if(a.connection){
                    this.vpnName = a.id;
                }
            });
            this.isVPN = vpnConnections.length > 0 ? true : false;

            this._session = new Soup.Session({ user_agent : 'ip-finder/' + Me.metadata.version, timeout: 5 });

            //global.log("IP-Finder: Getting IP Address...");
            this.gettingIpInfo = true;
            Utils._getIP(this._session, (ipAddrError, ipAddr) =>{
                if(ipAddrError === null){
                    //global.log("IP-Finder: Found IP Address - " + ipAddr);
                    Utils._getIPDetails(this._session, ipAddr, (ipDetailsError, ipDetails) => {
                        //global.log("IP-Finder: Getting IP Details...");
                        if(ipDetailsError === null){
                            //global.log("IP-Finder: Found IP Details. Creating new layout...");
                            this._loadDetails(ipDetails);
                        }
                        else{
                            //this.logSoupMessage(ipDetailsError, "Getting IP Details");
                            this._loadDetails(null);
                        }  
                    });
                }
                else{
                    //this.logSoupMessage(ipAddrError, "Getting IP Address");
                    this._loadDetails(null);
                }      
            });
            this._getIpInfoID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    logSoupMessage(error, functionName){
        for (let message in Soup.Status) {
            if (Soup.Status[message] === error)
                global.log("IP-Finder: Error on " + functionName + " - Soup.Status." + message);
        }
    }

    _loadDetails(data){
        if(data){
            this.ipAddr = data.ip;
            this._label.text = this.ipAddr;
            this._icon.icon_name = '';
            this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/flags/' + data.country + '.png');
            this.ipInfoBox.destroy_all_children();
            
            if(this._actorsInPanel === PANEL_ACTORS.IP)
                this._icon.hide();

            this._updatePanelStatus();

            let ipInfoRow = new St.BoxLayout();
            this.ipInfoBox.add_actor(ipInfoRow);

            this.ipInfoBox.add_actor(new PopupMenu.PopupSeparatorMenuItem());

            let label = new St.Label({
                style_class: this.isVPN ? 'ip-info-vpn-on' : 'ip-info-vpn-off',
                text: _("VPN") + ': ',
                x_align: Clutter.ActorAlign.FILL,
                y_align: Clutter.ActorAlign.START,
                y_expand: false,
            });
            ipInfoRow.add_actor(label);
            let vpnLabelText;
            if(this.isVPN)
                vpnLabelText = this.vpnName ? this.vpnName : _("On");
            else
                vpnLabelText =  _("Off");
            let vpnLabel = new St.Label({
                x_align: Clutter.ActorAlign.FILL,
                y_align: Clutter.ActorAlign.START,
                x_expand: true,
                y_expand: false,
                style_class: this.isVPN ? 'ip-info-vpn-on' : 'ip-info-vpn-off', 
                text: _(vpnLabelText),
            });
            ipInfoRow.add_actor(vpnLabel);
            let vpnIcon = new St.Icon({
                gicon: Gio.icon_new_for_string((this.isVPN ? (Me.path +"/icons/vpn-on-symbolic.svg") : (Me.path +"/icons/vpn-off-symbolic.svg"))),
                style_class: this.isVPN ? 'popup-menu-icon ip-info-vpn-on' : 'popup-menu-icon ip-info-vpn-off'
            });
            ipInfoRow.add_actor(vpnIcon);
            
            for(let key in DEFAULT_DATA){
                if(data[key]){
                    let ipInfoRow = new St.BoxLayout();
                    this.ipInfoBox.add_actor(ipInfoRow);
                    
                    let label = new St.Label({
                        style_class: 'ip-info-key',
                        text: _(DEFAULT_DATA[key].name) + ': ',
                        x_align: Clutter.ActorAlign.FILL,
                        y_align: Clutter.ActorAlign.CENTER,
                        y_expand: true,
                    });
                    ipInfoRow.add_actor(label);
    
                    let infoLabel = new St.Label({
                        x_align: Clutter.ActorAlign.FILL,
                        y_align: Clutter.ActorAlign.CENTER,
                        x_expand: true,
                        y_expand: true,
                        style_class: 'ip-info-value', 
                        text: data[key]
                    });
                    let dataLabelBtn = new St.Button({ 
                        child: infoLabel,
                    });
                    dataLabelBtn.connect('button-press-event', () => {
                        Clipboard.set_text(CLIPBOARD_TYPE, dataLabelBtn.child.text);
                    });
                    ipInfoRow.add_actor(dataLabelBtn);
                }
            }
            let tileNumber = Utils._getTileNumber(data['loc']);
            let tileCoords = tileNumber.x + "," + tileNumber.y;
            let tileCoordsUrl = tileNumber.z + "/" + tileNumber.x + "/" + tileNumber.y;

            if(tileCoords !== this._settings.get_string('map-tile-coords') || !this._checkLatestFileMapExists()){
                this._mapInfo.destroy_all_children();
                this._mapInfo.add_actor(this._getMapTile(DEFAULT_MAP_TILE));
                this._mapInfo.add_actor(new St.Label({
                    style_class: 'ip-info-key', 
                    text: _("Loading new map tile..."),
                    x_align: Clutter.ActorAlign.CENTER,
                }));
                Utils._getMapTile(this._session, tileCoordsUrl, (err, res) => {
                    //global.log("IP-Finder: Getting Tile Map...")
                    this._mapInfo.destroy_all_children();
                    if(err){
                        //this.logSoupMessage(ipAddrError, "Getting Tile Map");
                        this._mapInfo.add_actor(this._getMapTile(DEFAULT_MAP_TILE));
                        this._mapInfo.add_actor(new St.Label({
                            style_class: 'ip-info-key', 
                            text: _("Error Generating Image!"),
                            x_align: Clutter.ActorAlign.CENTER,
                        }));
                    }
                    else{
                        //global.log("IP-Finder: New IP Location - Using New Tile Map");
                        this._settings.set_string('map-tile-coords', tileCoords);
                        this._mapInfo.add_actor(this._getMapTile(LATEST_MAP_TILE));
                    }  
                });
            }
            else{
                //global.log("IP-Finder: Same IP Location - Using Previous Tile Map");
                this._mapInfo.destroy_all_children();
                this._mapInfo.add_actor(this._getMapTile(LATEST_MAP_TILE));
            }
        }  
        else{
            this._label.style_class = null;
            this._label.text = _("No Connection");
            this._icon.icon_name = 'network-offline-symbolic';
            this._vpnIcon.style_class = null;
            if(this.panelBox.contains(this._vpnIcon))
                this.panelBox.remove_actor(this._vpnIcon);
            this.ipInfoBox.destroy_all_children();
            for(let key in DEFAULT_DATA){
                let ipInfoRow = new St.BoxLayout();
                this.ipInfoBox.add_actor(ipInfoRow);

                let label = new St.Label({
                    style_class: 'ip-info-value', 
                    text: _(DEFAULT_DATA[key].name) + ': ',
                    x_align: Clutter.ActorAlign.FILL,
                });
                ipInfoRow.add_actor(label);
            }
            this._mapInfo.destroy_all_children();
            this._mapInfo.add_actor(this._getMapTile(DEFAULT_MAP_TILE));
            this._mapInfo.add_actor(new St.Label({
                style_class: 'ip-info-key', 
                text: _("No Connection"),
                x_align: Clutter.ActorAlign.CENTER,
            }));
        }
    }
    
    _getMapTile(mapTile){
        if(mapTile == DEFAULT_MAP_TILE)
            return new St.Icon({ gicon: Gio.icon_new_for_string(mapTile), icon_size: 200 });
        else if (mapTile == LATEST_MAP_TILE)
            return this._textureCache.load_file_async(Gio.file_new_for_path(LATEST_MAP_TILE), -1, 200, 1, 1); 
    }

    _checkLatestFileMapExists(){
        let file = Gio.File.new_for_path(LATEST_MAP_TILE);
        return file.query_exists(null);
    }

    disable() {
        if(this._getIpInfoID){
            GLib.source_remove(this._getIpInfoID);
            this._getIpInfoID = null;
        }

        if(this.activeConnectionsID){
            this._client.disconnect(this.activeConnectionsID);
            this.activeConnectionsID = null;
        }
        
        if(this._startUpCompleteID){
            Main.layoutManager.disconnect(this._startUpCompleteID);
            this._startUpCompleteID = null;
        }

        this._settings.run_dispose();
        this._settings = null;
    }

    _resetPanelPos() {
        Main.panel.statusArea['ip-menu'] = null;
        Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);
    }

    _showActorsInPanel(){
        if(this._actorsInPanel === PANEL_ACTORS.Flag_IP){
            this._icon.show();
            this._label.show();
        }
        else if(this._actorsInPanel === PANEL_ACTORS.Flag){
            this._icon.show();
            this._label.hide();
        }
        else if(this._actorsInPanel === PANEL_ACTORS.IP){
            this._icon.hide();
            this._label.show();
        }            
    }

    _updatePanelStatus(){
        if(this._vpnIconColors)
            this._vpnIcon.style_class = this.isVPN ? 'ip-info-vpn-on' : 'ip-info-vpn-off';  
        else
            this._vpnIcon.style_class = null;
        
        if(this._vpnIpAddrColors)
            this._label.style_class = this.isVPN ? 'ip-info-vpn-on' : 'ip-info-vpn-off';
        else
            this._label.style_class = null;
        
        if(this._vpnIcons){
            if(!this.panelBox.contains(this._vpnIcon))
                this.panelBox.insert_child_at_index(this._vpnIcon, 0);
            this._vpnIcon.gicon = Gio.icon_new_for_string(Me.path + (this.isVPN ? "/icons/vpn-on-symbolic.svg" : "/icons/vpn-off-symbolic.svg"));    
        }
        else{
            if(this.panelBox.contains(this._vpnIcon))
                this.panelBox.remove_actor(this._vpnIcon);
        }
    }

    _setPrefs(){  
        this._actorsInPanel = this._settings.get_enum(SETTINGS_ACTORS_IN_PANEL);     
        this._menuPosition = this._settings.get_string(SETTINGS_POSITION);
        this._vpnIcons = this._settings.get_boolean(SETTINGS_PANEL_VPN_ICONS);
        this._vpnIconColors = this._settings.get_boolean(SETTINGS_PANEL_VPN_ICON_COLORS);
        this._vpnIpAddrColors = this._settings.get_boolean(SETTINGS_PANEL_VPN_IP_ADDR_COLORS);
    }
});

function init() {
    ExtensionUtils.initTranslations();
}

let _indicator;

function enable() {
    _indicator = new IPMenu();
}

function disable() {
    _indicator.disable();
    _indicator.destroy();
    _indicator = null;
}
