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
import React, { useEffect, useState } from "react";
import {
    Card,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent,
    AlertGroup, Alert, AlertActionCloseButton
} from "@patternfly/react-core";
import { ExclamationCircleIcon } from "@patternfly/react-icons";

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { NavigatorBreadcrumbs } from "./navigator-breadcrumbs";
import { NavigatorCardBody } from "./navigator-card-body.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";
import { fsinfo } from "./fsinfo";

superuser.reload_page_on_change();

export const Application = () => {
    const { options } = usePageLocation();
    const [loading, setLoading] = useState(true);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [errorMessage, setErrorMessage] = useState();
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [rootInfo, setRootInfo] = useState();
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const [selected, setSelected] = useState([]);
    const [showHidden, setShowHidden] = useState(localStorage.getItem("cockpit-navigator.showHiddenFiles") === "true");
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
            if (options.path === undefined) {
                cockpit.location.replace("/", { path: encodeURIComponent(user.home) });
            }
        });
    }, [options]);

    useEffect(
        () => {
            if (sel === undefined) {
                return;
            }

            const info = fsinfo(
                `/${currentPath}`,
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
        [currentPath, sel]
    );

    if (loading)
        return <EmptyStatePanel loading />;

    const visibleFiles = !showHidden
        ? files.filter(file => !file.name.startsWith("."))
        : files;

    const addAlert = (title, variant, key) => setAlerts(prevAlerts => [...prevAlerts, { title, variant, key }]);
    const removeAlert = (key) => setAlerts(prevAlerts => [...prevAlerts.filter(alert => alert.key !== key)]);

    return (
        <Page>
            <NavigatorBreadcrumbs
              path={path}
              showHidden={showHidden} setShowHidden={setShowHidden}
            />
            <PageSection>
                <Sidebar isPanelRight hasGutter>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader
                              currentFilter={currentFilter} onFilterChange={onFilterChange}
                              isGrid={isGrid} setIsGrid={setIsGrid}
                              sortBy={sortBy} setSortBy={setSortBy}
                              currentDir={currentDir} files={files}
                            />
                            {errorMessage && <EmptyStatePanel paragraph={errorMessage} icon={ExclamationCircleIcon} />}
                            <NavigatorCardBody
                              currentFilter={currentFilter} files={visibleFiles}
                              path={path}
                              currentDir={currentDir}
                              isGrid={isGrid} sortBy={sortBy}
                              selected={selected} setSelected={setSelected}
                              loadingFiles={loadingFiles}
                              clipboard={clipboard}
                              setClipboard={setClipboard}
                              addAlert={addAlert}
                              allFiles={files}
                            />
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
                          showHidden={showHidden} setSelected={setSelected}
                          clipboard={clipboard} setClipboard={setClipboard}
                          files={files} addAlert={addAlert}
                        />
                    </SidebarPanel>
                </Sidebar>
            </PageSection>
        </Page>
    );
};
