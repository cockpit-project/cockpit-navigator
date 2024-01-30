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
import { superuser } from "superuser";
import { useDialogs } from "dialogs.jsx";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Card, CardBody,
    Flex,
    Gallery,
    Icon,
    MenuItem, MenuList,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent,
    CardTitle, Divider, AlertGroup, Alert, AlertActionCloseButton, Spinner, CardHeader,
} from "@patternfly/react-core";
import { ExclamationCircleIcon, FileIcon, FolderIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ContextMenu } from "./navigatorContextMenu.jsx";
import { NavigatorBreadcrumbs } from "./navigatorBreadcrumbs.jsx";
import {
    copyItem, createDirectory, createLink, deleteItem, editPermissions, pasteItem, renameItem
} from "./fileActions.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";
import { fsinfo } from "./fsinfo";

const _ = cockpit.gettext;

superuser.reload_page_on_change();

export const Application = () => {
    const { options } = usePageLocation();
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [errorMessage, setErrorMessage] = useState();
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [rootInfo, setRootInfo] = useState();
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const [selected, setSelected] = useState([]);
    const [selectedContext, setSelectedContext] = useState(null);
    const [showHidden, setShowHidden] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [clipboard, setClipboard] = useState(undefined);
    const [alerts, setAlerts] = useState([]);

    const onFilterChange = (_, value) => setCurrentFilter(value);
    const currentPath = decodeURIComponent(options.path || "");
    const path = currentPath?.split("/");
    const currentDir = path.join("/") + "/";
    const sel = (
        options.path !== undefined
            ? path[path.length - 1]
            : undefined
    );

    useEffect(() => {
        cockpit.user().then(user => {
            const userPath = user.home.split("/");
            setHistory(h => [...h, userPath]);

            if (options.path === undefined) {
                cockpit.location.go("/", { path: encodeURIComponent(user.home) });
            }
        });
    }, [options]);

    useEffect(
        () => {
            if (sel === undefined) {
                return;
            }

            const info = fsinfo(
                `/${currentDir}`,
                ["type", "mode", "size", "mtime", "user", "group", "target", "entries", "targets"]
            );
            return info.effect(state => {
                setLoading(false);
                setLoadingFiles(!(state.info || state.error));
                setRootInfo(state.info);
                setErrorMessage(state.error?.message ?? "");
                const entries = Object.entries(state?.info?.entries || {});
                const files = entries.map(([name, attrs]) => ({
                    ...attrs,
                    name,
                    to: info.target(name)?.type ?? null
                }));
                setFiles(files);
            });
        },
        [currentDir, sel]
    );

    if (loading)
        return <EmptyStatePanel loading />;

    const visibleFiles = !showHidden
        ? files.filter(file => !file.name.startsWith("."))
        : files;

    const _createDirectory = () => createDirectory(Dialogs, currentDir, selectedContext || selected);
    const _createLink = () => createLink(Dialogs, currentDir, files, selectedContext);
    const _copyItem = () => {
        copyItem(setClipboard, selected.length > 1
            ? selected.map(s => currentDir + s.name)
            : [currentDir + selectedContext.name]);
    };
    const _pasteItem = (targetPath, asSymlink) => pasteItem(clipboard, targetPath.join("/") + "/", asSymlink, addAlert);
    const _renameItem = () => renameItem(Dialogs, { selected: selectedContext, path, setHistory, setHistoryIndex });
    const _editPermissions = () => editPermissions(Dialogs, { selected: selectedContext || rootInfo, path });
    const _deleteItem = () => {
        deleteItem(
            Dialogs,
            {
                selected,
                itemPath: currentDir + selectedContext.name,
                setHistory,
                setHistoryIndex,
                path: currentDir,
                setSelected
            }
        );
    };

    const addAlert = (title, variant, key) => setAlerts(prevAlerts => [...prevAlerts, { title, variant, key }]);
    const removeAlert = (key) => setAlerts(prevAlerts => [...prevAlerts.filter(alert => alert.key !== key)]);

    const contextMenuItems = (
        <MenuList>
            {
                (!selectedContext
                    ? [
                        // eslint-disable-next-line max-len
                        { title: _("Paste"), onClick: () => _pasteItem(path, false), isDisabled: clipboard === undefined },
                        {
                            title: _("Paste as symlink"),
                            onClick: () => _pasteItem(path, true),
                            isDisabled: clipboard === undefined
                        },
                        { type: "divider" },
                        { title: _("Create directory"), onClick: _createDirectory },
                        { title: _("Create link"), onClick: _createLink },
                        { type: "divider" },
                        { title: _("Edit permissions"), onClick: _editPermissions }
                    ]
                    : selected.length > 1 && selected.includes(selectedContext)
                    // eslint-disable-next-line max-len
                        ? [{ title: _("Copy"), onClick: _copyItem }, { title: _("Delete"), onClick: _deleteItem, className: "pf-m-danger" }]
                        : [
                            { title: _("Copy"), onClick: _copyItem },
                            ...(selectedContext.type === "dir")
                                ? [
                                    {
                                        title: _("Paste into directory"),
                                        onClick: () => _pasteItem([...path, selectedContext.name], false),
                                        isDisabled: clipboard === undefined
                                    }
                                ]
                                : [],
                            { type: "divider" },
                            { title: _("Edit permissions"), onClick: _editPermissions },
                            { title: _("Rename"), onClick: _renameItem },
                            { type: "divider" },
                            { title: _("Create link"), onClick: _createLink },
                            { type: "divider" },
                            { title: cockpit.format(_("Delete")), onClick: _deleteItem, className: "pf-m-danger" },
                        ])
                        .map((item, i) => item.type !== "divider"
                            ? (
                                <MenuItem
                                  className={"context-menu-option " + item.className} key={item.title}
                                  onClick={item.onClick} isDisabled={item.isDisabled}
                                >
                                    <div className="context-menu-name">{item.title}</div>
                                </MenuItem>
                            )
                            : <Divider key={i} />)
            }
        </MenuList>
    );

    return (
        <Page>
            <NavigatorBreadcrumbs
              path={path}
              currentDir={currentDir}
              setHistory={setHistory} history={history}
              historyIndex={historyIndex} setHistoryIndex={setHistoryIndex}
            />
            <PageSection onContextMenu={() => {
                setSelectedContext(null);
                setSelected([{ name: sel }]);
            }}
            >
                <Sidebar isPanelRight hasGutter>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader
                              currentFilter={currentFilter} onFilterChange={onFilterChange}
                              isGrid={isGrid} setIsGrid={setIsGrid}
                              sortBy={sortBy} setSortBy={setSortBy}
                            />
                            {errorMessage && <EmptyStatePanel paragraph={errorMessage} icon={ExclamationCircleIcon} />}
                            <NavigatorCardBody
                              currentFilter={currentFilter} files={visibleFiles}
                              path={path}
                              currentDir={currentDir}
                              isGrid={isGrid} sortBy={sortBy}
                              selected={selected} setSelected={setSelected}
                              setSelectedContext={setSelectedContext} setHistory={setHistory}
                              setHistoryIndex={setHistoryIndex} historyIndex={historyIndex}
                              loadingFiles={loadingFiles}
                            />
                            {!loadingFiles &&
                            <ContextMenu
                              parentId="folder-view" contextMenuItems={contextMenuItems}
                              setSelectedContext={setSelectedContext}
                            />}
                            <AlertGroup isToast isLiveRegion>
                                {alerts.map(alert => (
                                    <Alert
                                      variant={alert.variant}
                                      title={alert.title}
                                      actionClose={
                                          <AlertActionCloseButton
                                            title={alert.title}
                                            variantLabel={`${alert.variant} alert`}
                                            onClose={() => removeAlert(alert.key)}
                                          />
                                      }
                                      key={alert.key}
                                    />
                                ))}
                            </AlertGroup>
                        </Card>
                    </SidebarContent>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails
                          path={path}
                          selected={selected.map(s => files.find(f => f.name === s.name)).filter(s => s !== undefined)}
                          currentDirectory={
                              {
                                  has_error: errorMessage,
                                  name: path[path.length - 1],
                                  items_cnt: {
                                      all: files.length,
                                      hidden: files.length - files.filter(file => !file.name.startsWith(".")).length
                                  }
                              }
                          }
                          setHistory={setHistory} setHistoryIndex={setHistoryIndex}
                          showHidden={showHidden} setSelected={setSelected}
                          setShowHidden={setShowHidden}
                          clipboard={clipboard} setClipboard={setClipboard}
                          files={files} addAlert={addAlert}
                        />
                    </SidebarPanel>
                </Sidebar>
            </PageSection>
        </Page>
    );
};

const compare = (sortBy) => {
    const compareFileType = (a, b) => {
        const aIsDir = (a.type === "dir" || a?.to === "dir");
        const bIsDir = (b.type === "dir" || b?.to === "dir");

        if (aIsDir && !bIsDir)
            return -1;
        if (!aIsDir && bIsDir)
            return 1;
        return 0;
    };

    switch (sortBy) {
    case "az":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.name.toLowerCase() < b.name.toLowerCase()
                ? -1
                : 1)
            : compareFileType(a, b);
    case "za":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.name.toLowerCase() > b.name.toLowerCase()
                ? -1
                : 1)
            : compareFileType(a, b);
    case "last_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.mtime > b.mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    case "first_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.mtime < b.mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    default:
        break;
    }
};

const NavigatorCardBody = ({
    currentFilter,
    files,
    historyIndex,
    isGrid,
    path,
    selected,
    setHistory,
    setHistoryIndex,
    setSelected,
    setSelectedContext,
    sortBy,
    loadingFiles
}) => {
    const [boxPerRow, setBoxPerRow] = useState(0);
    const Dialogs = useDialogs();
    const sortedFiles = useMemo(() => {
        const compareFunc = compare(sortBy);

        return files
                .filter(file => {
                    return file.name.toLowerCase().includes(currentFilter.toLowerCase());
                })
                .sort(compareFunc);
    }, [files, currentFilter, sortBy]);
    const isMounted = useRef(null);

    function calculateBoxPerRow () {
        if (!isGrid) {
            setBoxPerRow(1);
            return;
        }

        const boxes = document.querySelectorAll(".item-button");
        if (boxes.length > 1) {
            let i = 0;
            const total = boxes.length;
            const firstOffset = boxes[0].offsetTop;
            while (++i < total && boxes[i].offsetTop === firstOffset);
            setBoxPerRow(i);
        }
    }

    const onDoubleClickNavigate = useCallback((file) => {
        const newPath = [...path, file.name].join("/");
        if (file.type === "dir" || file.to === "dir") {
            setHistory(h => [...h.slice(0, historyIndex + 1), [...path, file.name]]);
            setHistoryIndex(h => h + 1);

            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    }, [
        path,
        historyIndex,
        setHistoryIndex,
        setHistory
    ]);

    useEffect(() => {
        calculateBoxPerRow();
        window.onresize = calculateBoxPerRow;
        return () => {
            window.onresize = undefined;
        };
    });

    useEffect(() => {
        const onKeyboardNav = (e) => {
            if (e.key === "ArrowRight") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = selectedIdx < sortedFiles.length - 1
                        ? selectedIdx + 1
                        : 0;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowLeft") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = selectedIdx > 0
                        ? selectedIdx - 1
                        : sortedFiles.length - 1;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowUp") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = Math.max(selectedIdx - boxPerRow, 0);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowDown") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = Math.min(selectedIdx + boxPerRow, sortedFiles.length - 1);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "Enter" && selected.length === 1) {
                onDoubleClickNavigate(selected[0]);
            }
        };

        if (!isMounted.current && !Dialogs.isActive()) {
            isMounted.current = true;
            document.addEventListener("keydown", onKeyboardNav);
        }
        if (Dialogs.isActive())
            document.removeEventListener("keydown", onKeyboardNav);
        return () => {
            isMounted.current = false;
            document.removeEventListener("keydown", onKeyboardNav);
        };
    }, [
        setSelected,
        sortedFiles,
        boxPerRow,
        selected,
        onDoubleClickNavigate,
        Dialogs
    ]);

    const resetSelected = e => {
        if (e.target.id === "folder-view" || e.target.id === "navigator-card-body") {
            setSelected([]);
        }
    };

    const handleClick = (ev, file) => {
        if (ev.detail > 1) {
            onDoubleClickNavigate(file);
        } else {
            if (!ev.ctrlKey || selected === path[path.length - 1]) {
                setSelected([file]);
            } else {
                setSelected(s => {
                    if (!s.find(f => f.name === file.name)) {
                        return [...s, file];
                    } else {
                        return s.filter(f => f.name !== file.name);
                    }
                });
            }
        }
    };

    const Item = ({ file }) => {
        const getFileType = (file) => {
            if (file.type === "dir") {
                return "directory-item";
            } else if (file.type === "lnk" && file?.to === "dir") {
                return "directory-item";
            } else {
                return "file-item";
            }
        };

        return (
            <Card
              className={"item-button " + getFileType(file)}
              data-item={file.name}
              id={"card-item-" + file.name + file.type}
              isClickable isCompact
              isPlain
              isSelected={selected.find(s => s.name === file.name)}
              onClick={ev => handleClick(ev, file)}
              onContextMenu={(e) => {
                  e.stopPropagation();
                  setSelectedContext(file);
                  if (selected.length === 1 || !selected.includes(file))
                      setSelected([file]);
              }}
              onDoubleClick={() => onDoubleClickNavigate(file)}
            >
                <CardHeader
                  selectableActions={{
                      name: file.name,
                      selectableActionAriaLabelledby: "card-item-" + file.name + file.type,
                      selectableActionId: "card-item-" + file.name + file.type + "-selectable-action",
                  }}
                >
                    <Icon
                      size={isGrid
                          ? "xl"
                          : "lg"} isInline
                    >
                        {file.type === "dir" || file.to === "dir"
                            ? <FolderIcon />
                            : <FileIcon />}
                    </Icon>
                    <CardTitle>
                        {file.name}
                    </CardTitle>
                </CardHeader>
            </Card>
        );
    };

    if (loadingFiles)
        return (
            <Flex justifyContent={{ default: "justifyContentCenter" }}>
                <Spinner />
            </Flex>
        );
    if (isGrid) {
        return (
            <CardBody onClick={resetSelected} id="navigator-card-body">
                <Gallery id="folder-view">
                    {sortedFiles.map(file => <Item file={file} key={file.name} />)}
                </Gallery>
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
