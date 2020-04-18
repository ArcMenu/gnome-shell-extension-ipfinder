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
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('IP-Finder');
const _ = Gettext.gettext;

const SETTINGS_COMPACT_MODE = 'compact-mode';

const SETTINGS_POSITION = 'position-in-panel';

var GeneralPage = GObject.registerClass( class IPFinder_GeneralPage extends Gtk.Box {
    _init(settings) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 24,
            spacing: 20,
            homogeneous: false,
            vexpand: true
        });

        this._settings = settings;

        let checkContainerFrame = new FrameBox();
        let checkContainer = new FrameBoxRow();
        let checkLabel = new Gtk.Label({
            label: _('Only Show Flag on Panel'),
            halign: Gtk.Align.START,
            hexpand: true
        });
   
        let checkButton = new Gtk.Switch({ 
            halign: Gtk.Align.END,
            tooltip_text: _("Disable Recently Installed Apps Indicator") 
        });

        checkContainer.add(checkLabel);
        checkContainer.add(checkButton);
        checkContainerFrame.add(checkContainer);

        this._settings.bind(SETTINGS_COMPACT_MODE, checkButton, 'active', Gio.SettingsBindFlags.DEFAULT);

        this.add(checkContainerFrame);

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

        this.add(positionContainerFrame);
    }
});

// About Page
var AboutPage = GObject.registerClass( class IPFinder_AboutPage extends Gtk.Box {
    _init(settings) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 24,
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
            let ipFinderImage = new Gtk.Image({ pixbuf: pixbuf });
            let ipFinderImageBox = new Gtk.VBox({
                margin_top: 0,
                margin_bottom: 0,
                expand: false
            });
            ipFinderImageBox.add(ipFinderImage);

            // Create the info box
            let ipFinderInfoBox = new Gtk.VBox({
                margin_top: 0,
                margin_bottom: 5,
                expand: false
            });
            let ipFinderLabel = new Gtk.Label({
                label: '<b>' + _('IP Finder - ArcMenu Team') + '</b>',
                use_markup: true,
                expand: false
            });
            let versionLabel = new Gtk.Label({
                label: _('Version: ') + releaseVersion,
                expand: false
            });
            let projectDescriptionLabel = new Gtk.Label({
                label: _('Displays useful information about your public IP Address'),
                expand: false
            });
            let projectLinkButton = new Gtk.LinkButton({
                label: _('GitLab Link'),
                uri: projectUrl,
                expand: false,
                halign: Gtk.Align.CENTER
            });

            let arcMenuTeamButton = new Gtk.LinkButton({
                label: _('ArcMenu Team on GitLab'),
                uri: 'https://gitlab.com/arcmenu-team',
                expand: false,
                halign: Gtk.Align.CENTER
            });
            
            this.creditsScrollWindow = new Gtk.ScrolledWindow();
            this.creditsScrollWindow.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            this.creditsScrollWindow.set_max_content_height(150);
            this.creditsScrollWindow.set_min_content_height(150);
            this.creditsFrame = new Gtk.Frame();
            this.creditsFrame.set_shadow_type(Gtk.ShadowType.NONE);
            this.creditsScrollWindow.add_with_viewport(this.creditsFrame);
  	        let creditsLabel = new Gtk.Label({
		        label: _(CREDITS),
		        use_markup: true,
		        justify: Gtk.Justification.CENTER,
		        expand: false
            });
            this.creditsFrame.add(creditsLabel);
            
            ipFinderInfoBox.add(ipFinderLabel);
            ipFinderInfoBox.add(versionLabel);
            ipFinderInfoBox.add(projectDescriptionLabel);
            ipFinderInfoBox.add(projectLinkButton);
            ipFinderInfoBox.add(arcMenuTeamButton);
            ipFinderInfoBox.add(this.creditsScrollWindow);

            // Create the GNU software box
            let gnuSofwareLabel = new Gtk.Label({
                label: _(GNU_SOFTWARE),
                use_markup: true,
                justify: Gtk.Justification.CENTER,
                expand: true
            });
            let gnuSofwareLabelBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL
            });
            gnuSofwareLabelBox.add(gnuSofwareLabel);

            this.add(ipFinderImageBox);
            this.add(ipFinderInfoBox);
            this.add(gnuSofwareLabelBox);
    }
});

var IPFinderPreferencesWidget = GObject.registerClass( class IPFinder_PreferencesWidget extends Gtk.Box{
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            border_width: 5
        });
        this._settings = Convenience.getSettings(Me.metadata['settings-schema']);
        
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

        this.add(notebook);
    }
});
function init() {
  Convenience.initTranslations("IP-Finder");
}

function buildPrefsWidget() {
  let widget = new IPFinderPreferencesWidget();
  widget.show_all();
  return widget;
}

var FrameBox = GObject.registerClass(class IPFinder_FrameBox extends Gtk.Frame {
    _init() {
        super._init({ label_yalign: 0.50 });
        this._listBox = new Gtk.ListBox();
        this._listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        this.count=0;
        Gtk.Frame.prototype.add.call(this, this._listBox);
    }

    add(boxRow) {
        this._listBox.add(boxRow);
        this.count++;
    }
    show() {
        this._listBox.show_all();
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
        this._listBox.show_all();
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
            margin: 5,
            column_spacing: 20,
            row_spacing: 20
        });
        Gtk.ListBoxRow.prototype.add.call(this, this._grid);
    }

    add(widget) {
        this._grid.add(widget);
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
