/*
 * ArcMenu Team - IP Finder GNOME Extension
 * https://gitlab.com/arcmenu-team/IP-Finder
 *
 * Modified Work - Andrew Zaech 2020 https://gitlab.com/AndrewZaech
 * Copyright (C) 2017 LinxGem33 (Andy C)
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
 *
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GLib, Gio, GObject, Soup, Shell, St} = imports.gi;
const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;
const Convenience = Me.imports.convenience;
const Gettext = imports.gettext.domain('IP-Finder');
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

const ICON_SIZE = 16;
const TILE_ZOOM = 9;

const SETTINGS_COMPACT_MODE = 'compact-mode';
const SETTINGS_POSITION = 'position-in-panel';

function _getIP(session, callback) {
    let uri = new Soup.URI("https://ipinfo.io/ip");
    var request = new Soup.Message({ method: 'GET', uri: uri });
    session.queue_message(request, (session, message) => {
        if (message.status_code !== Soup.Status.OK) {
            callback(message.status_code, null);
            return;
        }
        let ip = request.response_body.data;
        callback(null, ip);
    });
}

function _getIPDetails(session, ipAddr, callback) {
    global.log("https://ipinfo.io/" + ipAddr);
    let uri = new Soup.URI("https://ipinfo.io/" + ipAddr +"/json");
    var request = new Soup.Message({ method: 'GET', uri: uri });

    session.queue_message(request, (session, message) => {
        if (message.status_code !== Soup.Status.OK) {
            callback(message.status_code, null);
            return;
        }

        var ipDetailsJSON = request.response_body.data;
        var ipDetails = JSON.parse(ipDetailsJSON);
        callback(null, ipDetails);
    });
}

function _getTileNumber(loc) {
    let zoom = TILE_ZOOM;
    let [lat, lon] = loc.split(',');
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    let xtile = Math.floor((lon + 180.0) / 360.0 * (1 << zoom)); 
    let ytile = Math.floor((1.0 - Math.log(Math.tan(lat * Math.PI / 180.0) + 1.0 / Math.cos(lat * Math.PI / 180.0)) / Math.PI) / 2.0 * (1 << zoom));

    return("" + zoom + "/" + xtile + "/" + ytile);
}

function _getMapTile(IPMenu, tileInfo, callback) {
    IPMenu._mapInfo.destroy_all_children();
    IPMenu._mapInfo.add_actor(IPMenu._textureCache.load_file_async(Gio.file_new_for_path(Me.path + '/icons/default_map.png'),-1, 160, 1, 1));
    IPMenu._mapInfo.add_actor(new St.Label({
        style_class: 'ip-info-value', 
        text: _("Loading new map tile...")
    }));
    global.log("Loading new Map Tile...");
    let file = Gio.file_new_for_path(Me.path + '/icons/latest_map.png');

    let uri = new Soup.URI("https://a.tile.openstreetmap.org/" + tileInfo +".png");
    var request = new Soup.Message({ method: 'GET', uri: uri });

    IPMenu._session.queue_message(request, (session, message) => {
        if (message.status_code !== Soup.Status.OK) {
            global.log("ERROR GETTING MAP TILE IMAGE");
            callback(message.status_code);
        }
        else{
            let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            fstream.write_bytes(message.response_body_data, null);
            fstream.close(null);
            callback(null);
        }
    });

}

const DEFAULT_DATA = {
    ip: { name: _("IP Address"), text: _("No Connection")},
    org: { name: _("Hostname"), text: ''},
    city: { name: _("City"), text: ''},
    region: { name: _("Region"), text: ''},
    country: { name: _("Country"), text: ''},
    loc: { name: _("Location"), text: ''},
    postal: { name: _("Postal"), text: ''},
    timezone: { name: _("Timezone"), text: ''},
};

var IPMenu = GObject.registerClass(class IPMenu_IPMenu extends PanelMenu.Button{
    _init() {
        super._init(0.5, _('IP Details'));
        this._textureCache = St.TextureCache.get_default();
        this._session = new Soup.Session({ user_agent : 'ip-finder/' + Me.metadata.version });
        this._settings = Convenience.getSettings(Me.metadata['settings-schema']);

        this.setPrefs();

        let hbox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });

        this._icon = new St.Icon({
          gicon: Gio.icon_new_for_string(Me.path + '/icons/flags/US.png'),
          icon_size: ICON_SIZE,
          x_align: Clutter.ActorAlign.START,
          y_align: Clutter.ActorAlign.CENTER,
          style: "padding: 0px 5px;"
        });

        this.ipAddr = DEFAULT_DATA.ip.text;

        this._label = new St.Label({
            text: this._compactMode ? '' : this.ipAddr,
            y_align: Clutter.ActorAlign.CENTER
        });

        hbox.add_actor(this._icon);
        hbox.add_actor(this._label);

        this.add_actor(hbox);

        //main containers
        let ipInfo = new PopupMenu.PopupBaseMenuItem({reactive: false});
        let parentContainer = new St.BoxLayout(); //main container that holds ip info and map
        //

        //maptile
        this._mapInfo = new St.BoxLayout({ vertical: true });
        parentContainer.add_actor(this._mapInfo);

        //default map tile
        this._mapTile = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + '/icons/default_map.png'),
            icon_size: 160
        });

        this._mapInfo.add_actor(this._mapTile);
        //

        this.ipInfoBox = new St.BoxLayout({style_class: 'ip-info-box', vertical: true});
        parentContainer.add_actor(this.ipInfoBox);
        ipInfo.actor.add(parentContainer);
        this.menu.addMenuItem(ipInfo);

        this.ipInfoMap = new Map();

        this._getIpInfo();
    
        let buttonBox = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this._settingsIcon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._settingsButton = new St.Button({ 
            child: this._settingsIcon, 
            style_class: 'button' 
        });
        this._settingsButton.connect('clicked',  ()=> imports.misc.extensionUtils.openPrefs());

        buttonBox.add_actor(this._settingsButton);

        this._refreshIcon = new St.Icon({
            icon_name: 'view-refresh-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._refreshButton = new St.Button({ 
            child: this._refreshIcon,
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            style_class: 'button' 
        });
        this._refreshButton.connect('clicked',  ()=> this._getIpInfo());

        buttonBox.add_actor(this._refreshButton);


        this.menu.addMenuItem(buttonBox);

        this._settings.connect('changed', ()=> {
            this.setPrefs();
            this.resetPanelPos();
            this._label.text = this._compactMode ? '' : this.ipAddr;
        });

        Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);
    }

    _getIpInfo(){
        global.log("Getting IP Info...");
        _getIP(this._session, (ipAddrError, ipAddr) =>{
            global.log("IP Address Found - " + ipAddr);
            if(ipAddrError === null){
                _getIPDetails(this._session, ipAddr, (ipDetailsError, ipDetails) => {
                    if(ipDetailsError === null)
                        this._loadDetails(ipDetails);
                    else
                        this._loadDetails(null);
                });
            }
            else
                this._loadDetails(null);
        });
    }

    _loadDetails(data){
        if(data){
            this.ipAddr = data.ip;
            this._label.text = this._compactMode ? '' : this.ipAddr;
            this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/flags/' + data.country + '.png');
            this.ipInfoBox.destroy_all_children();
            for(let key in DEFAULT_DATA){
                let ipInfoRow = new St.BoxLayout();
                this.ipInfoBox.add_actor(ipInfoRow);

                let label = new St.Label({style_class: 'ip-info-key', text: DEFAULT_DATA[key].name + ': '});
                ipInfoRow.add_actor(label);

                let infoLabel = new St.Label({
                    x_align: Clutter.ActorAlign.FILL,
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
            let tileNumber = _getTileNumber(data['loc']);
            global.log(tileNumber);

            if(data.ip !== this._settings.get_string('ip-address') || this.tileError){
                this._settings.set_string('ip-address', data.ip);
                _getMapTile(this, tileNumber, (err, res) => {
                    this._mapInfo.destroy_all_children();

                    if(err){
                        global.log("Tile Error - Different IP");
                        this.tileError = true;
                        this._mapInfo.add_actor(this._textureCache.load_file_async(Gio.file_new_for_path(Me.path + '/icons/default_map.png'),-1, 160, 1, 1));
                        this._mapInfo.add_actor(new St.Label({
                            style_class: 'ip-info-value', 
                            text: _("Error Generating Image!")
                        }));
                    }
                    else{
                        global.log("No Tile Error - Different IP");
                        this.tileError = false;
                        this._mapInfo.add_child(this._textureCache.load_file_async(Gio.file_new_for_path(Me.path + '/icons/latest_map.png'), -1, 160, 1, 1));
                    }  
                });
            }
            else{
                global.log("Same IP");
                this._mapInfo.destroy_all_children();
                this._mapInfo.add_child(this._textureCache.load_file_async(Gio.file_new_for_path(Me.path + '/icons/latest_map.png'), -1, 160, 1, 1));
            }
        }  
    }
    
    destroy() {
        super.destroy();
    }

    resetPanelPos() {
        Main.panel.statusArea['ip-menu'] = null;
        Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);
    }

    setPrefs(){
        this._compactMode = this._settings.get_boolean(SETTINGS_COMPACT_MODE);        
        this._menuPosition = this._settings.get_string(SETTINGS_POSITION);
    }
});

function init() {
  Convenience.initTranslations("IP-Finder");
}

let _indicator;

function enable() {
  _indicator = new IPMenu();
}

function disable() {
  _indicator.destroy();
}
