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
import React, { useRef, useState } from "react";

import {
    Button,
    CardHeader,
    CardTitle,
    Flex,
    MenuToggle,
    MenuToggleAction,
    SearchInput,
    Select,
    SelectList,
    SelectOption,
    Text,
    TextContent,
    TextVariants
} from "@patternfly/react-core";
import { GripVerticalIcon, ListIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

export const NavigatorCardHeader = ({
    currentFilter, onFilterChange, isGrid, setIsGrid, sortBy, setSortBy, currentDir, files
}) => {
    const [chunksProgress, setChunksProgress] = useState({ number: 0, completed: 0 });
    const [isUploading, setIsUploading] = useState(false);
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
                <SearchInput
                  placeholder={_("Filter directory")} value={currentFilter}
                  onChange={onFilterChange}
                />
                <ViewSelector
                  isGrid={isGrid} setIsGrid={setIsGrid}
                  setSortBy={setSortBy} sortBy={sortBy}
                />
                <UploadButton
                  files={files} setChunksProgress={setChunksProgress}
                  isUploading={isUploading} setIsUploading={setIsUploading}
                  currentDir={currentDir}
                />
                <UploadProgress chunksProgress={chunksProgress} />
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

const UploadButton = ({ files, setChunksProgress, isUploading, setIsUploading, currentDir }) => {
    const BLOCK_SIZE = 16 * 1024;
    const ref = useRef();

    const handleClick = () => {
        ref.current.click();
    };
    console.log("files", files);

    const onUpload = event => {
        setChunksProgress({ completed: 0, number: 0 });

        console.log(event.target.files);
        for (let fileIndex = 0; fileIndex < event.target.files.length; fileIndex++) {
            const uploadedFile = event.target.files[fileIndex];
            console.log(uploadedFile);
            // TODO: duplicate file names?
            const fileName = uploadedFile.name;

            const reader = new FileReader();
            reader.readAsArrayBuffer(uploadedFile);
            const channel = cockpit.channel({
                binary: true,
                payload: "fsreplace1",
                path: `${currentDir}/${fileName}`,
                superuser: "try"
            });

            reader.onprogress = event => {
                console.log("progress", event);
                setChunksProgress({ completed: event.total, number: event.loaded });
            };

            reader.onload = readerEvent => {
                let len = 0;
                const content = readerEvent.target.result;
                console.log(content);
                len = content.byteLength;

                for (let i = 0; i < len; i += BLOCK_SIZE) {
                    const n = Math.min(len - i, BLOCK_SIZE);
                    channel.send(new window.Uint8Array(content, i, n));
                }
            };

            reader.onloadend = event => {
                // TODO: check for errors?
                console.log("loadend", event);
                channel.control({ command: "done" });
                setChunksProgress({ completed: 100, number: 100 });
            };
        }
    };

    return (
        <>
            <Button variant="secondary" onClick={handleClick}>Upload</Button>
            <input
              ref={ref} type="file"
              hidden onChange={onUpload}
            />
        </>
    );
};

const UploadProgress = ({ chunksProgress }) => {
    const progress = Math.round(100 * (chunksProgress.number / chunksProgress.completed));
    console.log("progress", progress);
    return (
        <div
          id="progress" className="progress-pie"
          title={`Upload ${progress}% completed`} style={{ "--progress": `${progress}%` }}
        />
    );
};
