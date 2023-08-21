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

import { createDirectory, createLink, deleteItem, editPermissions, renameItem } from "./fileActions.jsx";
import { permissions } from "./common.js";

const _ = cockpit.gettext;

export const SidebarPanelDetails = ({ selected, path, setPath, showHidden, setShowHidden, setHistory, setHistoryIndex, files, setIsEditing }) => {
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
    const getPermissions = (str) => {
        return permissions.find(e => e.value === str).label;
    };

    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text component={TextVariants.h2}>{selected.name}</Text>
                        {selected.items_cnt !== undefined &&
                            <Text component={TextVariants.small}>
                                {cockpit.format(cockpit.ngettext("$0 item $1", "$0 items $1", selected.items_cnt.all), selected.items_cnt.all, cockpit.format("($0 hidden)", selected.items_cnt.hidden))}
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
                  setIsEditing={setIsEditing}
                />
            </CardHeader>
            {selected.items_cnt === undefined &&
            <CardBody>
                <DescriptionList isHorizontal id="description-list-sidebar">
                    <DescriptionListGroup id="description-list-last-modified">
                        <DescriptionListTerm>{_("Last modified")}</DescriptionListTerm>
                        <DescriptionListDescription>{timeformat.dateTime(selected.modified * 1000)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-owner">
                        <DescriptionListTerm>{_("Owner")}</DescriptionListTerm>
                        <DescriptionListDescription>{selected.owner}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-group">
                        <DescriptionListTerm>{_("Group")}</DescriptionListTerm>
                        <DescriptionListDescription>{selected.group}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {selected.type === "file" &&
                    <DescriptionListGroup id="description-list-size">
                        <DescriptionListTerm>{_("Size")}</DescriptionListTerm>
                        <DescriptionListDescription>{cockpit.format("$0 $1", cockpit.format_bytes(selected.size), selected.size < 1000 ? "B" : "")}</DescriptionListDescription>
                    </DescriptionListGroup>}
                    <DescriptionListGroup id="description-list-owner-permissions">
                        <DescriptionListTerm>{_("Owner permissions")}</DescriptionListTerm>
                        <DescriptionListDescription>{getPermissions(selected.permissions[0])}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-group-permissions">
                        <DescriptionListTerm>{_("Group permissions")}</DescriptionListTerm>
                        <DescriptionListDescription>{getPermissions(selected.permissions[1])}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-other-permissions">
                        <DescriptionListTerm>{_("Other permissions")}</DescriptionListTerm>
                        <DescriptionListDescription>{getPermissions(selected.permissions[2])}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
                <Button variant="secondary" onClick={() => editPermissions(Dialogs, { selected, path })}>{_("Edit properties")}</Button>
            </CardBody>}
        </Card>
    );
};

const DropdownWithKebab = ({ selected, path, showHidden, setShowHidden, setHistory, setHistoryIndex, files, setIsEditing }) => {
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
                {selected.type !== "file" && selected.type !== "link" &&
                <>
                    <DropdownItem
                      id="show-hidden-items" key="show-hidden-items"
                      onClick={onToggleHidden}
                    >
                        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                            <FlexItem>{_("Show hidden items")}</FlexItem>
                            <FlexItem>{showHidden && <Icon size="sm"><CheckIcon className="check-icon" /></Icon>}</FlexItem>
                        </Flex>
                    </DropdownItem>
                    <DropdownItem
                      id="create-item" key="create-item"
                      onClick={() => { createDirectory(Dialogs, currentDirectory, selected) }}
                    >
                        {_("Create directory")}
                    </DropdownItem>
                </>}
                {selected.type === "file" &&
                <DropdownItem
                  id="edit-file" key="edit-file"
                  onClick={() => { setIsEditing(true) }}
                >
                    {_("Edit file")}
                </DropdownItem>}
                <DropdownItem
                  id="create-link" key="create-link"
                  onClick={() => { createLink(Dialogs, currentDirectory, files) }}
                >
                    {_("Create link")}
                </DropdownItem>
                <DropdownItem
                  id="rename-item" key="rename-item"
                  onClick={() => { renameItem(Dialogs, { selected, path, setHistory, setHistoryIndex }) }}
                >
                    {cockpit.format(_("Rename $0"), selected.type || "directory")}
                </DropdownItem>
                <DropdownItem
                  id="copy-path" key="copy-path"
                  onClick={() => { navigator.clipboard.writeText("/" + path.join("/") + "/" + (selected.type ? selected.name : "")) }}
                >
                    {_("Copy full path")}
                </DropdownItem>
                <DropdownItem
                  id="delete-item" key="delete-item"
                  onClick={() => { deleteItem(Dialogs, { selected, itemPath: currentDirectory + (selected.items_cnt ? "" : selected.name), path, setHistory, setHistoryIndex }) }} className="pf-m-danger"
                >
                    {cockpit.format(_("Delete $0"), selected.type || "directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
