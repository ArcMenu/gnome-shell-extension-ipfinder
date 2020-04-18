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

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('IP-Finder');
const _ = Gettext.gettext;

const SETTINGS_COMPACT_MODE = 'compact-mode';

const SETTINGS_POSITION = 'position-in-panel';

const IPMenuSettingsWidget = new GObject.Class({
  Name: 'IPMenu.Prefs.IPMenuSettingsWidget',
  GTypeName: 'IPMenuSettingsWidget',
  Extends: Gtk.Grid,

  _init: function (params) {
        this.parent(params);
        this.margin = 24;
        this.row_spacing = 6;
this.orientation = Gtk.Orientation.VERTICAL;

    this._settings = Convenience.getSettings(Me.metadata['settings-schema']);
 
let presentLabel = '<b>' + _("Display Options") + '</b>';
        this.add(new Gtk.Label({
            label: presentLabel, use_markup: true,
            halign: Gtk.Align.START
    }));


    let vbox = new Gtk.VBox();
    this.add(vbox);

    let checkContainer = new Gtk.HBox({spacing: 5});
    let checkLabel = new Gtk.Label({label: _('Only Show Flag on Panel')});
    let checkButton = new Gtk.CheckButton();

    checkContainer.pack_start(checkLabel, 0,0,0);
    checkContainer.pack_end(checkButton, 0,0,0);

    this._settings.bind(SETTINGS_COMPACT_MODE, checkButton, 'active', Gio.SettingsBindFlags.DEFAULT);

    vbox.add(checkContainer);

    let positionContainer = new Gtk.HBox({spacing: 5});
    let positionLabel = new Gtk.Label({label: _('IP Finder Position on the Panel')});
    let positionSelector = new Gtk.ComboBoxText();

    positionContainer.pack_start(positionLabel, 0,0,0);
    positionContainer.pack_end(positionSelector, 0,0,0);

    [_("left"),_("center"),_("right")].forEach(function(item) {
      positionSelector.append_text(item);
    });

    positionSelector.set_active(this._settings.get_enum(SETTINGS_POSITION));

    let self = this;

    positionSelector.connect('changed', function(pos) {
      self._settings.set_enum(SETTINGS_POSITION, positionSelector.get_active());
    });

    vbox.add(positionContainer);

  },
});

function init() {
  Convenience.initTranslations("IP-Finder");
}

function buildPrefsWidget() {
  let widget = new IPMenuSettingsWidget();
  widget.show_all();
  return widget;
}
