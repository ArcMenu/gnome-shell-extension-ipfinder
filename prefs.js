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

const {Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const SETTINGS_ACTORS_IN_PANEL = 'actors-in-panel';
const SETTINGS_POSITION = 'position-in-panel';
const SETTINGS_PANEL_VPN_ICONS = 'panel-vpn-icons';
const SETTINGS_PANEL_VPN_ICON_COLORS = 'panel-vpn-icon-colors';
const SETTINGS_PANEL_VPN_IP_ADDR_COLORS = 'panel-vpn-ip-addr-colors';

var GeneralPage = GObject.registerClass( class IPFinder_GeneralPage extends Gtk.Box {
    _init(settings) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
            spacing: 20,
            homogeneous: false,
            vexpand: true
        });

        this._settings = settings;

        let actorsInPanelContainerFrame = new FrameBox();
        let actorsInPanelContainer = new FrameBoxRow();
        let actorsInPanelLabel = new Gtk.Label({
            label: _('Elements to show on the Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
   
        let actorsInPanelSelector = new Gtk.ComboBoxText({ 
            halign: Gtk.Align.END
        });
        [_("IP Address and Flag"), _("Flag"), _("IP Address")].forEach( (item) => {
            actorsInPanelSelector.append_text(item);
        });

        actorsInPanelContainer.add(actorsInPanelLabel);
        actorsInPanelContainer.add(actorsInPanelSelector);
        actorsInPanelContainerFrame.add(actorsInPanelContainer);

        actorsInPanelSelector.set_active(this._settings.get_enum(SETTINGS_ACTORS_IN_PANEL));

        actorsInPanelSelector.connect('changed', () => {
            this._settings.set_enum(SETTINGS_ACTORS_IN_PANEL, actorsInPanelSelector.get_active());
        });

        this.append(actorsInPanelContainerFrame);

        let positionContainerFrame = new FrameBox();
        let positionContainer = new FrameBoxRow();
        let positionLabel = new Gtk.Label({
            label: _('IP Finder Position on the Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        let positionSelector = new Gtk.ComboBoxText();

        positionContainer.add(positionLabel);
        positionContainer.add(positionSelector);
        positionContainerFrame.add(positionContainer);

        [_("Left"), _("Center"), _("Right")].forEach( (item) => {
            positionSelector.append_text(item);
        });

        positionSelector.set_active(this._settings.get_enum(SETTINGS_POSITION));

        positionSelector.connect('changed', () => {
            this._settings.set_enum(SETTINGS_POSITION, positionSelector.get_active());
        });

        this.append(positionContainerFrame);

        let panelVpnIconsFrame = new FrameBox();
        let panelVpnIconsContainer = new FrameBoxRow();
        let panelVpnIconsLabel = new Gtk.Label({
            label: _('Show VPN Status Icon on the Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        let panelVpnIconsSwitch = new Gtk.Switch();
        panelVpnIconsSwitch.set_active(this._settings.get_boolean(SETTINGS_PANEL_VPN_ICONS))
        panelVpnIconsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean(SETTINGS_PANEL_VPN_ICONS, widget.get_active());
        });

        panelVpnIconsContainer.add(panelVpnIconsLabel);
        panelVpnIconsContainer.add(panelVpnIconsSwitch);
        panelVpnIconsFrame.add(panelVpnIconsContainer);
        this.append(panelVpnIconsFrame);

        let panelVpnColorsFrame = new FrameBox();
        let panelVpnColorsContainer = new FrameBoxRow();
        let panelVpnColorsLabel = new Gtk.Label({
            label: _('VPN Status Color for VPN Icon on the Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        let panelVpnColorsSwitch = new Gtk.Switch();
        panelVpnColorsSwitch.set_active(this._settings.get_boolean(SETTINGS_PANEL_VPN_ICON_COLORS))
        panelVpnColorsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean(SETTINGS_PANEL_VPN_ICON_COLORS, widget.get_active());
        });

        panelVpnColorsContainer.add(panelVpnColorsLabel);
        panelVpnColorsContainer.add(panelVpnColorsSwitch);
        panelVpnColorsFrame.add(panelVpnColorsContainer);
        this.append(panelVpnColorsFrame);

        let panelVpnIpColorsFrame = new FrameBox();
        let panelVpnIpColorsContainer = new FrameBoxRow();
        let panelVpnIpColorsLabel = new Gtk.Label({
            label: _('VPN Status Color for IP Text on the Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        let panelVpnIpColorsSwitch = new Gtk.Switch();
        panelVpnIpColorsSwitch.set_active(this._settings.get_boolean(SETTINGS_PANEL_VPN_IP_ADDR_COLORS))
        panelVpnIpColorsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean(SETTINGS_PANEL_VPN_IP_ADDR_COLORS, widget.get_active());
        });

        panelVpnIpColorsContainer.add(panelVpnIpColorsLabel);
        panelVpnIpColorsContainer.add(panelVpnIpColorsSwitch);
        panelVpnIpColorsFrame.add(panelVpnIpColorsContainer);
        this.append(panelVpnIpColorsFrame);
       
    }
});

var AboutPage = GObject.registerClass( class IPFinder_AboutPage extends Gtk.Box {
    _init(settings) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
            spacing: 20,
            homogeneous: false
        });

        this._settings = settings;
        let releaseVersion;
            if(Me.metadata.version)
                releaseVersion = Me.metadata.version;
            else
                releaseVersion = 'unknown';
            let projectUrl = Me.metadata.url;

            // Create GUI elements
            // Create the image box
            let logoPath = Me.path + '/icons/default_map.png';
            let [imageWidth, imageHeight] = [150, 150];
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(logoPath, imageWidth, imageHeight);
            let ipFinderImage = Gtk.Picture.new_for_pixbuf(pixbuf);
            let ipFinderImageBox = new Gtk.Box({
                margin_top: 0,
                margin_bottom: 0,
                hexpand: false,
                orientation: Gtk.Orientation.VERTICAL
            });
            ipFinderImageBox.append(ipFinderImage);

            // Create the info box
            let ipFinderInfoBox = new Gtk.Box({
                margin_top: 0,
                margin_bottom: 5,
                hexpand: false,
                orientation: Gtk.Orientation.VERTICAL
            });
            let ipFinderLabel = new Gtk.Label({
                label: '<b>' + _('IP Finder - ArcMenu Team') + '</b>',
                use_markup: true,
                hexpand: false
            });
            let versionLabel = new Gtk.Label({
                label: _('Version: ') + releaseVersion,
                hexpand: false
            });
            let projectDescriptionLabel = new Gtk.Label({
                label: _('Displays useful information about your public IP Address'),
                hexpand: false
            });
            let projectLinkButton = new Gtk.LinkButton({
                label: _('GitLab Link'),
                uri: projectUrl,
                hexpand: false,
                halign: Gtk.Align.CENTER
            });

            let arcMenuTeamButton = new Gtk.LinkButton({
                label: _('ArcMenu Team on GitLab'),
                uri: 'https://gitlab.com/arcmenu-team',
                hexpand: false,
                halign: Gtk.Align.CENTER
            });
            
            this.creditsScrollWindow = new Gtk.ScrolledWindow();
            this.creditsScrollWindow.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            this.creditsScrollWindow.set_max_content_height(150);
            this.creditsScrollWindow.set_min_content_height(150);
            this.creditsFrame = new Gtk.Frame();
            this.creditsScrollWindow.set_child(this.creditsFrame);
  	        let creditsLabel = new Gtk.Label({
		        label: _(CREDITS),
		        use_markup: true,
		        justify: Gtk.Justification.CENTER,
		        hexpand: false
            });
            this.creditsFrame.set_child(creditsLabel);
            
            ipFinderInfoBox.append(ipFinderLabel);
            ipFinderInfoBox.append(versionLabel);
            ipFinderInfoBox.append(projectDescriptionLabel);
            ipFinderInfoBox.append(projectLinkButton);
            ipFinderInfoBox.append(arcMenuTeamButton);
            ipFinderInfoBox.append(this.creditsScrollWindow);

            // Create the GNU software box
            let gnuSofwareLabel = new Gtk.Label({
                label: _(GNU_SOFTWARE),
                use_markup: true,
                justify: Gtk.Justification.CENTER,
                hexpand: true
            });
            let gnuSofwareLabelBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL
            });
            gnuSofwareLabelBox.append(gnuSofwareLabel);

            this.append(ipFinderImageBox);
            this.append(ipFinderInfoBox);
            this.append(gnuSofwareLabelBox);
    }
});

var IPFinderPreferencesWidget = GObject.registerClass( class IPFinder_PreferencesWidget extends Gtk.Box{
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
        
        let notebook = new Gtk.Notebook();

        let generalPage = new GeneralPage(this._settings);
        notebook.append_page(generalPage, new Gtk.Label({
            label: "<b>" + _("General") + "</b>",
            use_markup: true
        }));

        let aboutPage = new AboutPage(this._settings);
        notebook.append_page(aboutPage, new Gtk.Label({
            label: "<b>" + _("About") + "</b>",
            use_markup: true
        }));

        this.append(notebook);
    }
});

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    let widget = new IPFinderPreferencesWidget();
    widget.show();
    return widget;
}

var FrameBox = GObject.registerClass(class IPFinder_FrameBox extends Gtk.Frame {
    _init() {
        super._init({ });
        this._listBox = new Gtk.ListBox();
        this._listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        this.count=0;
        Gtk.Frame.prototype.set_child.call(this, this._listBox);
    }

    add(boxRow) {
        this._listBox.append(boxRow);
        this.count++;
    }
    show() {
        this._listBox.show();
    }
    length() {
        return this._listBox.length;
    }
    remove(boxRow) {
        this._listBox.remove(boxRow);
        this.count = this.count -1;
    }
    remove_all_children() {
        let children = this._listBox.get_children();
        for(let i = 0; i < children.length; i++){
            let child = children[i];
            this._listBox.remove(child);
        }
        this.count = 0;
        this._listBox.show();
    }
    get_index(index){
        return this._listBox.get_row_at_index(index);
    }
    insert(row,pos){
        this._listBox.insert(row,pos);
        this.count++;
    }
});

var FrameBoxRow = GObject.registerClass(class IPFinder_FrameBoxRow extends Gtk.ListBoxRow {
    _init() {
        super._init({});
        this._grid = new Gtk.Grid({
            margin_top: 5,
            margin_bottom: 5,
            margin_start: 5,
            margin_end: 5,
            column_spacing: 20,
            row_spacing: 20
        });
        this.x = 0;
        Gtk.ListBoxRow.prototype.set_child.call(this, this._grid);
    }

    add(widget) {
        this._grid.attach(widget, this.x, 0, 1, 1);
        this.x++;
    }
});

var CREDITS = '\n<b>Credits:</b>'+
		'\n\nCurrent Active Developers'+
		'\n <a href="https://gitlab.com/LinxGem33">@LinxGem33</a>  (Founder/Maintainer/Graphic Designer)'+
		'\n<a href="https://gitlab.com/AndrewZaech">@AndrewZaech</a>  (Lead JavaScript/UX Developer)';
        
var GNU_SOFTWARE = '<span size="small">' +
    'This program comes with absolutely no warranty.\n' +
    'See the <a href="https://gnu.org/licenses/old-licenses/gpl-2.0.html">' +
	'GNU General Public License, version 2 or later</a> for details.' +
	'</span>';
