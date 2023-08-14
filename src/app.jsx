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
import { useDialogs } from "dialogs.jsx";
import React, { useEffect, useState, useRef } from "react";
import {
    Button,
    Card, CardBody,
    Flex, FlexItem,
    Icon,
    MenuItem, MenuList,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent, Truncate,
} from "@patternfly/react-core";
import { FileIcon, FolderIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";
import { ContextMenu } from "./navigatorContextMenu.jsx";
import { NavigatorBreadcrumbs } from "./navigatorBreadcrumbs.jsx";
import { createDirectory, createLink, deleteItem, editPermissions, renameItem } from "./fileActions.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";

const _ = cockpit.gettext;

export const Application = () => {
    const { options } = usePageLocation();
    const Dialogs = useDialogs();
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const channel = useRef(null);
    const [selected, setSelected] = useState(null);
    const [selectedContext, setSelectedContext] = useState(null);
    const [showHidden, setShowHidden] = useState(false);
    const [historyIndex, setHistoryIndex] = useState({ length: 1, current: 0 });

    const onFilterChange = (_, value) => setCurrentFilter(value);

    // eslint-disable-next-line no-restricted-globals
    useEffect(() => history.replaceState({ index: historyIndex.current }, ""));

    useEffect(() => {
        cockpit.user().then(user => {
            if (options.path === undefined) {
                cockpit.location.go("?path=root" + user.home);
            }
        });
    }, [options]);

    const path = options.path ? options.path.slice(5).split("/") : [];
    useEffect(() => {
        if (options.path === undefined)
            return;

        const path = options.path ? options.path.slice(5).split("/") : [];
        setSelected(path[path.length - 1]);

        const getFsList = () => {
            if (channel.current !== null)
                channel.current.close();

            const currentPath = options.path.slice(4) || "/";
            channel.current = cockpit.channel({
                payload: "fslist1",
                path: currentPath,
                superuser: "try",
                watch: true,
            });

            const files = [];
            channel.current.addEventListener("message", (ev, data) => {
                const item = JSON.parse(data);
                if (item.event === "present") {
                    files.push({ ...item, name: item.path, isHidden: item.path.startsWith(".") });
                } else {
                    const name = item.path.slice(item.path.lastIndexOf("/") + 1);
                    if (item.event === "deleted") {
                        setFiles(f => f.filter(res => res.name !== name));
                    } else {
                        // For events other than 'present' we don't receive file stat information
                        // so we rerun the fslist command to get the updated information
                        // https://github.com/allisonkarlitskaya/systemd_ctypes/issues/56
                        const name = item.path.slice(item.path.lastIndexOf("/") + 1);
                        if (name[0] !== ".") {
                            getFsList();
                        }
                    }
                }
            });

            channel.current.addEventListener("ready", () => {
                Promise.all(files.map(file => {
                    return cockpit.spawn(["stat", "-c", "%a", currentPath + "/" + file.path], { superuser: "try" }).then(res => {
                        // trim newline character
                        res = res.slice(0, -1);
                        // trim sticky bit
                        if (res.length === 4) res = res.slice(1);
                        if (res.length === 1) res = "00".concat(res);
                        if (res.length === 2) res = "0".concat(res);
                        return { ...file, permissions: res };
                    });
                })).then(res => {
                    Promise.all(res.map(file => {
                        return cockpit.spawn(["file", currentPath + "/" + file.path], { superuser: "try" }).then(res => {
                            return { ...file, info: res.split(":")[1].slice(0, -1) };
                        });
                    })).then(res => setFiles(res));
                });
            });
        };
        getFsList();
    }, [options]);

    if (!options?.path)
        return null;

    const visibleFiles = !showHidden ? files.filter(file => !file.name.startsWith(".")) : files;

    const contextMenuItems = (
        <MenuList>
            <MenuItem className="context-menu-option" onClick={() => { createDirectory(Dialogs, "/" + path.join("/") + "/", selectedContext || selected) }}>
                <div className="context-menu-name"> {_("Create directory")}</div>
            </MenuItem>
            <MenuItem className="context-menu-option" onClick={() => { createLink(Dialogs, "/" + path.join("/") + "/", files, selectedContext) }}>
                <div className="context-menu-name"> {_("Create link")}</div>
            </MenuItem>
            {selectedContext &&
            <>
                <MenuItem className="context-menu-option" onClick={() => { navigator.clipboard.writeText("/" + path.join("/") + "/" + selectedContext.name) }}>
                    <div className="context-menu-name"> {_("Copy full path")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option" onClick={() => { renameItem(Dialogs, { selected: selectedContext, path }) }}>
                    <div className="context-menu-name"> {selectedContext.type === "file" ? _("Rename file") : _("Rename directory")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option" onClick={() => { editPermissions(Dialogs, { selected: selectedContext, path }) }}>
                    <div className="context-menu-name"> {_("Edit properties")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option pf-m-danger" onClick={() => { deleteItem(Dialogs, { selected: selectedContext, itemPath: "/" + path.join("/") + "/" + selectedContext.name }) }}>
                    <div className="context-menu-name"> {selectedContext.type === "file" ? _("Delete file") : _("Delete directory")} </div>
                </MenuItem>
            </>}
        </MenuList>
    );

    return (
        <Page>
            <NavigatorBreadcrumbs
              path={path} historyIndex={historyIndex}
              setHistoryIndex={setHistoryIndex} options={options}
            />
            <PageSection onContextMenu={() => { setSelectedContext(null); setSelected(path[path.length - 1]) }}>
                <Sidebar isPanelRight hasGutter>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails
                          path={path} selected={(files.find(file => file.name === selected?.name)) || ({ name: path[path.length - 1], items_cnt: { all: files.length, hidden: files.length - files.filter(file => !file.name.startsWith(".")).length } })}
                          showHidden={showHidden}
                          setShowHidden={setShowHidden} files={files}
                        />
                    </SidebarPanel>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader
                              currentFilter={currentFilter} onFilterChange={onFilterChange}
                              isGrid={isGrid} setIsGrid={setIsGrid}
                              sortBy={sortBy} setSortBy={setSortBy}
                            />
                            <NavigatorCardBody
                              currentFilter={currentFilter} files={visibleFiles}
                              path={path}
                              isGrid={isGrid} sortBy={sortBy}
                              selected={selected} setSelected={setSelected}
                              setSelectedContext={setSelectedContext} options={options}
                              historyIndex={historyIndex} setHistoryIndex={setHistoryIndex}
                            />
                            <ContextMenu
                              parentId="folder-view" contextMenuItems={contextMenuItems}
                              setSelectedContext={setSelectedContext}
                            />
                        </Card>
                    </SidebarContent>
                </Sidebar>
            </PageSection>
        </Page>
    );
};

const NavigatorCardBody = ({ currentFilter, files, isGrid, path, sortBy, selected, setSelected, setSelectedContext, historyIndex, setHistoryIndex, options }) => {
    const onDoubleClickNavigate = (path, file) => {
        if (file.type === "directory") {
            cockpit.location.go("?path=" + options.path + "/" + file.name);
            if (historyIndex.current + 1 === historyIndex.length)
                setHistoryIndex(i => ({ length: i.length + 1, current: i.length }));
            else
                setHistoryIndex(i => ({ length: i.current + 2, current: i.current + 1 }));
        }
    };

    const resetSelected = e => {
        if (e.target.id === "folder-view" || e.target.id === "navigator-card-body")
            setSelected(path[path.length - 1]);
    };

    const filteredItems = files
            .filter(file => {
                return file.name.toLowerCase().includes(currentFilter.toLowerCase());
            });

    let compare;
    switch (sortBy) {
    case "az":
        compare = (a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        break;
    case "za":
        compare = (a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? -1 : 1;
        break;
    case "last_modified":
        compare = (a, b) => a.modified > b.modified ? -1 : 1;
        break;
    case "first_modified":
        compare = (a, b) => a.modified < b.modified ? -1 : 1;
        break;
    default:
        break;
    }

    const filteredFolders = filteredItems.filter((item) => (item.type === "directory"));
    const filteredFiles = filteredItems.filter((item) => (item.type === "file"));
    const sortedFiles = filteredFolders.sort(compare).concat(filteredFiles.sort(compare));

    const Item = ({ file }) => {
        return (
            <Button
              data-item={file.name} variant="plain"
              onDoubleClick={() => onDoubleClickNavigate(path, file)} onClick={() => setSelected(file)}
              onContextMenu={(e) => { e.stopPropagation(); setSelectedContext(file) }} className={"item-button " + (file.type === "directory" ? "directory-item" : "file-item")}
            >
                <Flex direction={{ default: isGrid ? "column" : "row" }} spaceItems={{ default: isGrid ? "spaceItemsNone" : "spaceItemsMd" }}>
                    <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                        <Icon size={isGrid ? "xl" : "lg"} isInline>
                            {file.type === "directory"
                                ? <FolderIcon />
                                : <FileIcon />}
                        </Icon>
                    </FlexItem>
                    <FlexItem className={"pf-u-text-break-word pf-u-text-wrap" + (isGrid ? " grid-file-name" : "")}>
                        {selected?.name !== file.name ? <Truncate content={file.name} position="middle" /> : file.name}
                    </FlexItem>
                </Flex>
            </Button>
        );
    };

    if (isGrid) {
        return (
            <CardBody onClick={resetSelected} id="navigator-card-body">
                <Flex id="folder-view">
                    {sortedFiles.map(file => <Item file={file} key={file.name} />)}
                </Flex>
            </CardBody>
        );
    } else {
        return (
            <ListingTable
              id="folder-view"
              className="pf-m-no-border-rows"
              variant="compact"
              columns={[_("Name")]}
              rows={sortedFiles.map(file => ({ columns: [{ title: <Item file={file} key={file.name} /> }] }))}
            />
        );
    }
};
