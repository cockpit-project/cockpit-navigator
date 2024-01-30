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
import { usePageLocation } from "hooks.js";

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon } from "@patternfly/react-icons";

export const NavigatorBreadcrumbs = ({ currentDir, path, history, setHistory, historyIndex, setHistoryIndex }) => {
    const { options } = usePageLocation();
    const isEditing = options.edit !== undefined;
    const navigateBack = () => {
        if (historyIndex > 0) {
            cockpit.location.go("/", { path: encodeURIComponent(history[historyIndex - 1].join("/")) });
            setHistoryIndex(i => i - 1);
        }
    };

    const navigateForward = () => {
        if (historyIndex < history.length) {
            cockpit.location.go("/", { path: encodeURIComponent(history[historyIndex + 1].join("/")) });
            setHistoryIndex(i => i + 1);
        }
    };

    const navigateBreadcrumb = (i) => {
        setHistory(h => [...h.slice(0, historyIndex + 1), path.slice(0, i)]);
        setHistoryIndex(i => i + 1);
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, i).join("/")) });
    };

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex>
                {!isEditing &&
                <>
                    <FlexItem>
                        <Button
                          variant="secondary" onClick={navigateBack}
                          isDisabled={historyIndex === 0} id="navigate-back"
                        >
                            <ArrowLeftIcon />
                        </Button>
                    </FlexItem>
                    <FlexItem>
                        <Button
                          variant="secondary" onClick={navigateForward}
                          isDisabled={history.length === historyIndex + 1} id="navigate-forward"
                        >
                            <ArrowRightIcon />
                        </Button>
                    </FlexItem>
                </>}
                <FlexItem>
                    <Flex spaceItems={{ default: "spaceItemsXs" }}>
                        {path.map((dir, i) => {
                            return (
                                <React.Fragment key={dir || "/"}>
                                    {i !== path.length - 1 &&
                                        <Button
                                          variant="link" onClick={() => { navigateBreadcrumb(i + 1) }}
                                          key={dir} className="breadcrumb-button"
                                        >
                                            {dir || "/"}
                                        </Button>}
                                    {i === path.length - 1 && <p className="last-breadcrumb-button">{dir || "/"}</p>}
                                    {dir !== "" && <p key={i}>/</p>}
                                </React.Fragment>
                            );
                        })}
                    </Flex>
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
};
