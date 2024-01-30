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
    createDirectory, createLink, deleteItem, editPermissions, renameItem, updateFile, copyItem, pasteItem
} from "./fileActions.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";
import { FileEditor } from "./FileEditor.jsx";

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
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const channel = useRef(null);
    const channelList = useRef(null);
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

    const getFsList = useCallback(() => {
        const _files = [];
        setLoadingFiles(true);

        if (channelList.current !== null)
            channelList.current.close();

        channelList.current = cockpit.channel({
            payload: "fslist1",
            path: `/${currentDir}`,
            superuser: "try",
            watch: false,
        });

        channelList.current.addEventListener("message", (ev, data) => {
            const file = JSON.parse(data);

            _files.push({ ...file, name: file.path, isHidden: file.path.startsWith(".") });
        });

        channelList.current.addEventListener("close", (ev, data) => {
            setLoading(false);
            if (data?.problem && data?.message) {
                setErrorMessage(data.message);
                setLoadingFiles(false);
            } else {
                setErrorMessage(null);
                Promise.all(_files.map(file => updateFile(file, currentDir)))
                        .then(() => {
                            setFiles(_files);
                            setLoadingFiles(false);
                        });
            }
        });
    }, [currentDir]);

    const watchFiles = useCallback(() => {
        if (channel.current !== null)
            channel.current.close();

        channel.current = cockpit.channel({
            payload: "fswatch1",
            path: `/${currentDir}`,
            superuser: "try",
        });

        channel.current.addEventListener("message", (ev, data) => {
            const item = JSON.parse(data);

            item.name = item.path.slice(item.path.lastIndexOf("/") + 1);
            item.isHidden = item.name.startsWith(".");

            // When files are created with some file editor we get also 'attribute-changed' and
            // 'done-hint' events which are handled below. We should not add the same file twice.
            if (item.event === "created" && item.type === "directory") {
                updateFile(item, currentDir).then(file => {
                    setFiles(_f => [..._f, file]);
                });
            } else {
                if (item.event === "deleted") {
                    setFiles(f => f.filter(res => res.name !== item.name));
                } else {
                    // For events other than 'present' we don't receive file stat information
                    // so we rerun the fslist command to get the updated information
                    // https://github.com/allisonkarlitskaya/systemd_ctypes/issues/56
                    if (item.name[0] !== ".") {
                        getFsList();
                    }
                }
            }
        });
    }, [currentDir, getFsList]);

    useEffect(() => {
        // Wait for the path initial value to be set before fetching the files
        if (sel === undefined) {
            return;
        }

        setSelected([]);
        setFiles([]);
        setLoading(true);

        watchFiles();
        getFsList();
    }, [sel, getFsList, watchFiles]);

    if (loading)
        return <EmptyStatePanel loading />;

    const visibleFiles = !showHidden
        ? files.filter(file => !file.isHidden)
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
    const _editPermissions = () => editPermissions(Dialogs, { selected: selectedContext, path });
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
    const _setIsEditing = () => {
        setSelected([selectedContext]);
        cockpit.location.go("/", { path: encodeURIComponent(path.join("/")), edit: selectedContext.name });
    };

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
                            ...(selectedContext.type !== "directory" && selectedContext.isText)
                                ? [{ title: _("Edit file"), onClick: _setIsEditing }]
                                : [],
                            { title: _("Copy"), onClick: _copyItem },
                            ...(selectedContext.type === "directory")
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
        const aIsDir = (a.type === "directory" || a?.to === "directory");
        const bIsDir = (b.type === "directory" || b?.to === "directory");

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
            ? (a.modified > b.modified
                ? -1
                : 1)
            : compareFileType(a, b);
    case "first_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.modified < b.modified
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
    const { options } = usePageLocation();
    const isEditing = options.edit !== undefined;
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
        if (file.type === "directory" || file.to === "directory") {
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
            if (file.type === "directory") {
                return "directory-item";
            } else if (file.type === "link" && file?.to === "directory") {
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
                        {file.type === "directory" || file.to === "directory"
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
    if (!isEditing) {
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
    } else {
        return (<FileEditor path={path} />);
    }
};
