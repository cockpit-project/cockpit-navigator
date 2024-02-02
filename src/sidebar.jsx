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

import React, { useState, useEffect } from "react";

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Divider,
    Dropdown,
    DropdownItem,
    DropdownList,
    Flex,
    FlexItem,
    Icon,
    MenuToggle,
    Text,
    TextContent,
    TextVariants,
} from "@patternfly/react-core";

import {
    CheckIcon,
    EllipsisVIcon,
} from "@patternfly/react-icons";

import * as timeformat from "timeformat";
import { useDialogs } from "dialogs.jsx";

import {
    copyItem, createDirectory, createLink, deleteItem, editPermissions, pasteItem, renameItem,
    downloadFile,
} from "./fileActions.jsx";
import { get_permissions } from "./common";

const _ = cockpit.gettext;

const getDescriptionListItems = selected => {
    return ([
        {
            id: "description-list-last-modified",
            label: _("Last modified"),
            value: timeformat.dateTime(selected.mtime * 1000)
        },
        {
            id: "description-list-owner",
            label: _("Owner"),
            value: selected.user
        },
        {
            id: "description-list-group",
            label: _("Group"),
            value: selected.group
        },
        ...(selected.type === "reg"
            ? [
                {
                    id: "description-list-size",
                    label: _("Size"),
                    value: cockpit.format(
                        "$0 $1",
                        cockpit.format_bytes(selected.size),
                        selected.size < 1000
                            ? "B"
                            : "",
                    )
                },
            ]
            : []),
        {
            id: "description-list-owner-permissions",
            label: _("Owner permissions"),
            value: get_permissions(selected.mode >> 6),
        },
        {
            id: "description-list-group-permissions",
            label: _("Group permissions"),
            value: get_permissions(selected.mode >> 3),
        },
        {
            id: "description-list-other-permissions",
            label: _("Other permissions"),
            value: get_permissions(selected.mode >> 0),
        },
    ]);
};

export const SidebarPanelDetails = ({
    files,
    path,
    selected,
    setHistory,
    setHistoryIndex,
    setPath,
    setShowHidden,
    showHidden,
    setSelected,
    currentDirectory,
    clipboard,
    setClipboard,
    addAlert,
    user,
}) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        if (selected.length === 1) {
            const filePath = path.join("/") + "/" + selected[0]?.name;

            cockpit.spawn(["file", "--brief", filePath], { superuser: "try", error: "message" })
                    .then(res => setInfo(res?.trim()))
                    .catch(error => console.warn(`Failed to run file --brief on ${filePath}: ${error.toString()}`));
        }
    }, [path, selected]);

    const Dialogs = useDialogs();
    const hidden_count = currentDirectory.items_cnt.hidden;
    let shown_items = cockpit.format(cockpit.ngettext("$0 item", "$0 items", currentDirectory.items_cnt.all),
                                     currentDirectory.items_cnt.all);
    if (!showHidden)
        shown_items += " " + cockpit.format(cockpit.ngettext("($0 hidden)", "($0 hidden)", hidden_count), hidden_count);

    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text component={TextVariants.h2}>{selected.length === 1
                            ? selected[0].name
                            : currentDirectory.name}
                        </Text>
                        {selected.length === 0 && !currentDirectory.has_error &&
                            <Text component={TextVariants.small}>
                                {shown_items}
                            </Text>}
                        {selected.length > 1 &&
                            <Text component={TextVariants.small}>
                                {cockpit.format("$0 items selected", selected.length)}
                            </Text>}
                        {selected.length === 1 &&
                            <Text component={TextVariants.small}>
                                {info}
                            </Text>}
                    </TextContent>
                </CardTitle>
                <DropdownWithKebab
                  selected={selected} path={path}
                  setPath={setPath} showHidden={showHidden}
                  setShowHidden={setShowHidden} setHistory={setHistory}
                  setHistoryIndex={setHistoryIndex} files={files}
                  clipboard={clipboard} setClipboard={setClipboard}
                  setSelected={setSelected} currentDirectory={currentDirectory}
                  addAlert={addAlert}
                  user={user}
                />
            </CardHeader>
            {selected.length === 1 &&
            <CardBody>
                <DescriptionList isHorizontal id="description-list-sidebar">
                    {getDescriptionListItems(selected[0]).map((item, index) => (
                        <DescriptionListGroup key={item.id} id={item.id}>
                            <DescriptionListTerm>{item.label}</DescriptionListTerm>
                            <DescriptionListDescription>
                                {item.value}
                            </DescriptionListDescription>
                        </DescriptionListGroup>))}
                </DescriptionList>
                <Button
                  variant="secondary"
                  onClick={() => {
                      editPermissions(Dialogs, { selected: selected[0], path });
                  }}
                >
                    {_("Edit permissions")}
                </Button>
            </CardBody>}
        </Card>
    );
};

const DropdownWithKebab = ({
    selected,
    path,
    showHidden,
    setShowHidden,
    setHistory,
    setHistoryIndex,
    files,
    clipboard,
    setClipboard,
    setSelected,
    currentDirectory,
    addAlert,
    user,
}) => {
    const Dialogs = useDialogs();
    const [isOpen, setIsOpen] = useState(false);

    const onToggleClick = () => setIsOpen(!isOpen);
    const onSelect = (_event, itemId) => setIsOpen(false);
    const onToggleHidden = () => {
        setShowHidden(showHidden => {
            localStorage.setItem("cockpit-navigator.showHiddenFiles", !showHidden ? "true" : "false");
            return !showHidden;
        });
    };

    const currentPath = path.join("/") + "/";

    const showHiddenItems = (
        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <FlexItem>{_("Show hidden items")}</FlexItem>
            <FlexItem>
                {showHidden &&
                <Icon size="sm">
                    <CheckIcon className="check-icon" />
                </Icon>}
            </FlexItem>
        </Flex>
    );

    const singleDropdownOptions = [
        ...selected.length === 0
            ? [{ id: "show-hidden-items", onClick: onToggleHidden, title: showHiddenItems }]
            : [],
        {
            id: "copy-path",
            onClick: () => {
                navigator.clipboard.writeText(path.join("/") + "/" + (selected.length === 1
                    ? selected[0].name
                    : ""));
            },
            title: _("Copy full path")
        },
        { type: "divider" },
        ...selected.length === 1
            ? [
                {
                    id: "copy-item",
                    onClick: () => copyItem(setClipboard, [path.join("/") + "/" + selected[0].name]),
                    title: _("Copy"),
                }
            ]
            : [],
        ...selected.length === 0
            ? [
                {
                    id: "paste-item",
                    onClick: () => pasteItem(clipboard, path.join("/") + "/", false, addAlert),
                    title: _("Paste"),
                    isDisabled: clipboard === undefined
                }
            ]
            : [],
        ...(selected.length === 1 && selected[0].type === "dir")
            ? [
                {
                    id: "paste-into-directory",
                    onClick: () => {
                        pasteItem(clipboard, path.join("/") + "/" + selected[0].name + "/", false, addAlert);
                    },
                    title: _("Paste into directory"),
                    isDisabled: clipboard === undefined
                }
            ]
            : [],
        ...selected.length === 0
            ? [
                {
                    id: "paste-as-symlink",
                    onClick: () => pasteItem(clipboard, path.join("/") + "/", true, addAlert),
                    title: _("Paste as symlink"),
                    isDisabled: clipboard === undefined
                }
            ]
            : [],
        { type: "divider" },
        ...selected.length === 0
            ? [
                {
                    id: "create-item",
                    onClick: () => createDirectory(Dialogs, currentPath, selected),
                    title: _("Create directory")
                }
            ]
            : [],
        {
            id: "create-link",
            onClick: () => createLink(Dialogs, currentPath, files, selected[0]),
            title: _("Create link")
        },
        { type: "divider" },
        {
            id: "edit-permissions",
            onClick: () => {
                editPermissions(Dialogs, {
                    selected: selected.length === 0
                        ? null
                        : selected[0],
                    path
                });
            },
            title: _("Edit permissions")
        },
        {
            id: "rename-item",
            onClick: () => {
                renameItem(Dialogs, { selected: selected[0] || currentDirectory, path, setHistory, setHistoryIndex });
            },
            title: _("Rename")
        },
        ...(selected.length === 1 && selected[0].type === "reg")

            ? [
                { type: "divider" },
                {
                    id: "download-item",
                    onClick: () => downloadFile(currentPath, selected[0]),
                    title: _("Download")
                }
            ]
            : [],
        { type: "divider" },
        {
            id: "delete-item",
            onClick: () => {
                deleteItem(Dialogs, {
                    selected,
                    itemPath: currentPath + (selected.length === 0
                        ? ""
                        : selected[0].name),
                    path,
                    setHistory,
                    setHistoryIndex,
                    setSelected,
                    currentDirectory
                });
            },
            title: _("Delete"),
            className:"pf-m-danger"
        },
    ];

    const multiDropdownOptions = [
        {
            id: "copy-item",
            onClick: () => copyItem(setClipboard, selected.map(s => path.join("/") + "/" + s.name)),
            title: _("Copy")
        },
        {
            id: "delete-item",
            onClick: () => {
                deleteItem(Dialogs, {
                    selected,
                    path: currentPath,
                    setHistory,
                    setHistoryIndex,
                    setSelected
                });
            },
            title:_("Delete"),
            className:"pf-m-danger"
        }
    ];

    const dropdownOptions = selected.length > 1
        ? multiDropdownOptions
        : singleDropdownOptions;

    return (
        <Dropdown
          isOpen={isOpen}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef =>
              <MenuToggle
                ref={toggleRef} variant="plain"
                onClick={onToggleClick} isExpanded={isOpen}
                id="dropdown-menu"
              >
                  <EllipsisVIcon />
              </MenuToggle>}
        >
            <DropdownList>
                {dropdownOptions.map((option, i) => {
                    if (option.type === "divider")
                        return <Divider key={i} />;
                    return (
                        <DropdownItem
                          id={option.id} key={option.id}
                          className={option.className} onClick={option.onClick}
                          isDisabled={option.isDisabled}
                        >
                            {option.title}
                        </DropdownItem>
                    );
                })}
            </DropdownList>
        </Dropdown>
    );
};
