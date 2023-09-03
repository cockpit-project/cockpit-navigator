/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from "cockpit";
import React from "react";

import { ForceDeleteModal } from "../fileActions";

const options = { err: "message", superuser: "try" };

const renameCommand = ({ selected, path, name }) => {
    return selected.items_cnt
        ? ["mv", "/" + path.join("/"), "/" + path.slice(0, -1).join("/") + "/" + name]
        : ["mv", "/" + path.join("/") + "/" + selected.name, "/" + path.join("/") + "/" + name];
};

export const spawnDeleteItem = (o) => {
    cockpit.spawn(["rm", "-r", o.itemPath], options)
            .then(() => {
                if (o.selected.items_cnt) {
                    const newPath = "/" + o.path.slice(0, -1).join("/");

                    cockpit.location.go("/", { path: encodeURIComponent(newPath) });
                    o.setHistory(h => h.slice(0, -1));
                    o.setHistoryIndex(i => i - 1);
                }
            })
            .then(o.Dialogs.close, err => {
                o.Dialogs.show(
                    <ForceDeleteModal
                      selected={o.selected} itemPath={o.itemPath}
                      initialError={err.message}
                    />
                );
            });
};

export const spawnForceDelete = (o) => {
    cockpit.spawn(["rm", "-rf", o.itemPath], options)
            .then(o.Dialogs.close, err => {
                o.setDeleteFailed(true);
                o.setErrorMessage(err.message);
            });
};

export const spawnRenameItem = (o) => {
    const newPath = o.selected.items_cnt
        ? "/" + o.path.slice(0, -1).join("/") + "/" + o.name
        : "/" + o.path.join("/") + "/" + o.name;

    cockpit.spawn(renameCommand({ selected: o.selected, path: o.path, name: o.name }), options)
            .then(() => {
                if (o.selected.items_cnt) {
                    cockpit.location.go("/", { path: encodeURIComponent(newPath) });
                    o.setHistory(h => h.slice(0, -1));
                    o.setHistoryIndex(i => i - 1);
                }
                o.Dialogs.close();
            }, err => o.setErrorMessage(err.message));
};

export const spawnCreateDirectory = (o) => {
    let path;
    if (o.selected.icons_cnt || o.selected.type === "directory") {
        path = o.currentPath + o.selected.name + "/" + o.name;
    } else {
        path = o.currentPath + o.name;
    }
    cockpit.spawn(["mkdir", path], options)
            .then(o.Dialogs.close, err => o.setErrorMessage(err.message));
};

export const spawnCreateLink = (o) => {
    cockpit.spawn([
        "ln",
        ...(o.type === "symbolic"
            ? ["-s"]
            : []),
        o.currentPath + o.originalName.slice(o.originalName.lastIndexOf("/") + 1),
        o.currentPath + o.newName
    ], options)
            .then(o.Dialogs.close, (err) => { o.setErrorMessage(err.message) });
};

export const spawnEditPermissions = (o) => {
    const command = [
        "chmod",
        ...(o.changeAll
            ? ["-R"]
            : []),
        o.ownerAccess + o.groupAccess + o.otherAccess,
        "/" + o.path.join("/") + "/" + o.selected.name
    ];
    const permissionChanged = (
        o.ownerAccess !== o.selected.permissions[0] ||
        o.groupAccess !== o.selected.permissions[1] ||
        o.otherAccess !== o.selected.permissions[2]
    );
    const ownerChanged = o.owner !== o.selected.owner || o.group !== o.selected.group;
    const nameChanged = o.name !== o.selected.name;

    Promise.resolve()
            .then(() => {
                if (permissionChanged)
                    return cockpit.spawn(command, options);
            })
            .then(() => {
                if (ownerChanged) {
                    return cockpit.spawn(
                        ["chown", o.owner + ":" + o.group, "/" + o.path.join("/") + "/" + o.selected.name],
                        options
                    );
                }
            })
            .then(() => {
                if (nameChanged)
                    return cockpit.spawn(renameCommand({ selected: o.selected, path: o.path, name: o.name }), options);
            })
            .then(o.Dialogs.close, err => o.setErrorMessage(err.message));
};

export const spawnDuplicateItem = (path, name) => {
    cockpit.spawn([
        "cp",
        "-r",
        path + name,
        path + name + " - Copy"
    ]);
};
