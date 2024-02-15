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
import React, { useState } from "react";

import {
    CardHeader,
    CardTitle,
    Flex,
    MenuToggle,
    MenuToggleAction,
    Select,
    SelectList,
    SelectOption,
    Text,
    TextContent,
    TextVariants,
    Button,
    TextInputGroup, TextInputGroupMain, TextInputGroupUtilities,
} from "@patternfly/react-core";
import { GripVerticalIcon, ListIcon, SearchIcon, TimesIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

export const NavigatorCardHeader = ({
    currentFilter, setCurrentFilter, onFilterChange, isGrid, setIsGrid, sortBy, setSortBy
}) => {
    return (
        <CardHeader className="card-actionbar">
            <CardTitle component="h2" id="navigator-card-header">
                <TextContent>
                    <Text component={TextVariants.h2}>
                        {_("Directories & files")}
                    </Text>
                </TextContent>
            </CardTitle>
            <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsCenter" }}>
                <TextInputGroup>
                    <TextInputGroupMain
                      icon={<SearchIcon />} value={currentFilter}
                      onChange={onFilterChange} placeholder={_("Filter directory")}
                    />
                    <TextInputGroupUtilities>
                        <Button
                          variant="plain" onClick={_ => setCurrentFilter("")}
                          aria-label={_("Clear button and input")}
                        >
                            <TimesIcon />
                        </Button>
                    </TextInputGroupUtilities>
                </TextInputGroup>
                <ViewSelector
                  isGrid={isGrid} setIsGrid={setIsGrid}
                  setSortBy={setSortBy} sortBy={sortBy}
                />
            </Flex>
        </CardHeader>
    );
};

const ViewSelector = ({ isGrid, setIsGrid, sortBy, setSortBy }) => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = isOpen => setIsOpen(!isOpen);
    const onSelect = (ev, itemId) => {
        setIsOpen(false);
        setSortBy(itemId);
        localStorage.setItem("cockpit-navigator.sort", itemId);
    };

    return (
        <Select
          id="sort-menu"
          isOpen={isOpen}
          selected={sortBy}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef => (
              <MenuToggle
                id="sort-menu-toggle"
                className="view-toggle-group"
                isExpanded={isOpen}
                onClick={() => onToggleClick(isOpen)}
                ref={toggleRef}
                splitButtonOptions={{
                    variant: "action",
                    items: [
                        <MenuToggleAction
                          aria-label={isGrid
                              ? _("Display as a list")
                              : _("Display as a grid")}
                          key="view-toggle-action"
                          onClick={() => setIsGrid(!isGrid)}
                        >
                            {isGrid
                                ? <ListIcon className="view-toggle-icon" />
                                : <GripVerticalIcon className="view-toggle-icon" />}
                        </MenuToggleAction>
                    ]
                }}
                variant="secondary"
              />
          )}
        >
            <SelectList>
                <SelectOption itemId="az">{_("A-Z")}</SelectOption>
                <SelectOption itemId="za">{_("Z-A")}</SelectOption>
                <SelectOption itemId="last_modified">{_("Last modified")}</SelectOption>
                <SelectOption itemId="first_modified">{_("First modified")}</SelectOption>
            </SelectList>
        </Select>
    );
};
