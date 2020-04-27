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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Gio, Soup} = imports.gi;

const TILE_ZOOM = 9;

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

    return({z: zoom, x: xtile, y: ytile});
}

function _getMapTile(session, tileInfo, callback) {
    let file = Gio.file_new_for_path(Me.path + '/icons/latest_map.png');

    let uri = new Soup.URI("https://a.tile.openstreetmap.org/" + tileInfo +".png");
    var request = new Soup.Message({ method: 'GET', uri: uri });

    session.queue_message(request, (session, message) => {
        if (message.status_code !== Soup.Status.OK) 
            callback(message.status_code);
        else{
            let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            fstream.write_bytes(message.response_body_data, null);
            fstream.close(null);
            callback(null);
        }
    });
}
