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

import { createDirectory, createFile, createLink, deleteItem, editPermissions, renameItem } from "./fileActions.jsx";
import { permissions } from "./common.js";

const _ = cockpit.gettext;

const getDescriptionListItems = selected => {
    const getPermissions = (str) => {
        return permissions.find(e => e.value === str).label;
    };

    return ([
        {
            id: "description-list-last-modified",
            label: _("Last modified"),
            value: timeformat.dateTime(selected.modified * 1000)
        },
        {
            id: "description-list-owner",
            label: _("Owner"),
            value: selected.owner
        },
        {
            id: "description-list-group",
            label: _("Group"),
            value: selected.group
        },
        ...(selected.type === "file"
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
            value: getPermissions(selected.permissions[0])
        },
        {
            id: "description-list-group-permissions",
            label: _("Group permissions"),
            value: getPermissions(selected.permissions[1])
        },
        {
            id: "description-list-other-permissions",
            label: _("Other permissions"),
            value: getPermissions(selected.permissions[2])
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
}) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        const filePath = path.join("/") + "/" + selected.path;

        cockpit.spawn(["file", filePath], { superuser: "try", error: "message" })
                .then(res => {
                    const _info = res.split(":")[1].slice(0, -1);
                    setInfo(_info);
                }, console.error);
    }, [path, selected]);

    const Dialogs = useDialogs();

    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text component={TextVariants.h2}>{selected.name}</Text>
                        {!selected.has_error && selected.items_cnt !== undefined &&
                            <Text component={TextVariants.small}>
                                {cockpit.format(
                                    cockpit.ngettext(
                                        "$0 item $1", "$0 items $1",
                                        selected.items_cnt.all
                                    ),
                                    selected.items_cnt.all,
                                    cockpit.format("($0 hidden)", selected.items_cnt.hidden)
                                )}
                            </Text>}
                        {selected.items_cnt === undefined &&
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
                />
            </CardHeader>
            {selected.items_cnt === undefined &&
            <CardBody>
                <DescriptionList isHorizontal id="description-list-sidebar">
                    {getDescriptionListItems(selected).map((item, index) => (
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
                      editPermissions(Dialogs, { selected, path });
                  }}
                >
                    {_("Edit properties")}
                </Button>
            </CardBody>}
        </Card>
    );
};

const DropdownWithKebab = ({ selected, path, showHidden, setShowHidden, setHistory, setHistoryIndex, files }) => {
    const Dialogs = useDialogs();
    const [isOpen, setIsOpen] = useState(false);

    const onToggleClick = () => {
        setIsOpen(!isOpen);
    };
    const onSelect = (_event, itemId) => {
        setIsOpen(false);
    };
    const onToggleHidden = () => {
        setShowHidden(!showHidden);
    };

    const currentDirectory = "/" + path.join("/") + "/";

    return (
        <Dropdown
          isPlain
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
                {selected.items_cnt &&
                    <DropdownItem
                      id="show-hidden-items" key="show-hidden-items"
                      onClick={onToggleHidden}
                    >
                        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                            <FlexItem>{_("Show hidden items")}</FlexItem>
                            <FlexItem>
                                {showHidden &&
                                <Icon size="sm">
                                    <CheckIcon className="check-icon" />
                                </Icon>}
                            </FlexItem>
                        </Flex>
                    </DropdownItem>}
                <DropdownItem
                  id="copy-path" key="copy-path"
                  onClick={() => {
                      navigator.clipboard.writeText("/" + path.join("/") + "/" + (selected.type
                          ? selected.name
                          : ""));
                  }}
                >
                    {_("Copy full path")}
                </DropdownItem>
                <Divider />
                {selected.items_cnt &&
                <>
                    <DropdownItem
                      id="create-file" key="create-file"
                      onClick={() => { createFile(Dialogs, currentDirectory, files) }}
                    >
                        {_("Create file")}
                    </DropdownItem>
                    <DropdownItem
                      id="create-item" key="create-item"
                      onClick={() => { createDirectory(Dialogs, currentDirectory, selected) }}
                    >
                        {_("Create directory")}
                    </DropdownItem>
                </>}
                <DropdownItem
                  id="create-link" key="create-link"
                  onClick={() => { createLink(Dialogs, currentDirectory, files) }}
                >
                    {_("Create link")}
                </DropdownItem>
                <Divider />
                <DropdownItem
                  id="edit-properties" key="edit-properties"
                  onClick={() => {
                      editPermissions(Dialogs, {
                          selected: selected.items_cnt
                              ? null
                              : selected,
                          path
                      });
                  }}
                >
                    {_("Edit properties")}
                </DropdownItem>
                <DropdownItem
                  id="rename-item" key="rename-item"
                  onClick={() => {
                      renameItem(Dialogs, { selected, path, setHistory, setHistoryIndex });
                  }}
                >
                    {cockpit.format(_("Rename $0"), selected.type || "directory")}
                </DropdownItem>
                <Divider />
                <DropdownItem
                  id="delete-item" key="delete-item"
                  onClick={() => {
                      deleteItem(Dialogs, {
                          selected,
                          itemPath: currentDirectory + (selected.items_cnt
                              ? ""
                              : selected.name),
                          path,
                          setHistory,
                          setHistoryIndex
                      });
                  }} className="pf-m-danger"
                >
                    {cockpit.format(_("Delete $0"), selected.type || "directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
