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
import React, { useEffect, useState } from "react";
import { usePageLocation } from "hooks.js";
import { onBeforeUnload } from "./fileActions";

import { Button, CardBody, Flex, FlexItem, TextArea } from "@patternfly/react-core";

export const FileEditor = ({ path }) => {
    const [editorText, setEditorText] = useState(null);
    const { options } = usePageLocation();
    const editorFile = options.edit;

    useEffect(() => {
        cockpit.file("/" + path.join("/") + "/" + editorFile).read()
                .then(res => setEditorText(res));
    }, [path, editorFile]);

    const cancelEdit = () => {
        cockpit.location.go("/", { path: encodeURIComponent(path.join("/")) });
        window.removeEventListener("beforeunload", onBeforeUnload);
    };

    const saveEdit = () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
        const fileName = "/" + path.join("/") + "/" + editorFile;
        if (editorText === "") {
            cockpit.spawn([
                "truncate",
                "-s",
                "0",
                fileName
            ]).then(() => {
                cockpit.location.go("/", { path: encodeURIComponent(path.join("/")) });
            });
        } else {
            cockpit.file(fileName)
                    .replace(editorText)
                    .then(() => {
                        cockpit.location.go("/", { path: encodeURIComponent(path.join("/")) });
                    });
        }
    };

    const onEditorChange = (_, value) => {
        window.addEventListener("beforeunload", onBeforeUnload);
        setEditorText(value);
    };

    return (
        <CardBody id="text-editor-card">
            {editorText !== null &&
                <Flex spaceItems={{ default: "spaceItemsSm" }}>
                    <TextArea
                      id="text-editor"
                      value={editorText}
                      onChange={onEditorChange}
                    />
                    <FlexItem>
                        <Button variant="primary" onClick={saveEdit}>Save</Button>
                    </FlexItem>
                    <FlexItem>
                        <Button variant="danger" onClick={cancelEdit}>Cancel</Button>
                    </FlexItem>
                </Flex>}
        </CardBody>
    );
};
