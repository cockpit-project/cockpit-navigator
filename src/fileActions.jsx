/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
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
import {
    Button,
    Form, FormGroup,
    FormSection,
    FormSelect,
    FormSelectOption,
    Modal, ModalVariant,
    Radio,
    Stack,
    TextInput,
} from "@patternfly/react-core";

import { useDialogs } from "dialogs.jsx";
import { InlineNotification } from "cockpit-components-inline-notification";
import { useFile } from "hooks.js";
import {
    etc_group_syntax as etcGroupSyntax,
    etc_passwd_syntax as etcPasswdSyntax
} from "pam_user_parser.js";
import { FileAutoComplete } from "../pkg/lib/cockpit-components-file-autocomplete";
import {
    spawnCreateDirectory,
    spawnCreateLink,
    spawnDeleteItem,
    spawnEditPermissions,
    spawnForceDelete,
    spawnPaste,
    spawnRenameItem
} from "./apis/spawnHelpers";
import { map_permissions, inode_types } from "./common";

const _ = cockpit.gettext;

export const createDirectory = (Dialogs, currentPath, selected) => {
    Dialogs.show(<CreateDirectoryModal currentPath={currentPath} selected={selected} />);
};

export const createLink = (Dialogs, currentPath, files, selected) => {
    Dialogs.show(
        <CreateLinkModal
          currentPath={currentPath} selected={selected}
          files={files.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase())
              ? 1
              : ((b.name.toLowerCase() > a.name.toLowerCase())
                  ? -1
                  : 0))}
        />
    );
};

export const deleteItem = (Dialogs, options) => {
    Dialogs.show(
        <ConfirmDeletionDialog
          selected={options.selected} itemPath={options.itemPath}
          path={options.path} setSelected={options.setSelected}
          setHistory={options.setHistory} setHistoryIndex={options.setHistoryIndex}
          currentDirectory={options.currentDirectory}
        />
    );
};

export const renameItem = (Dialogs, options) => {
    Dialogs.show(
        <RenameItemModal
          path={options.path}
          selected={options.selected}
          setHistory={options.setHistory} setHistoryIndex={options.setHistoryIndex}
        />
    );
};

export const editPermissions = (Dialogs, options) => {
    Dialogs.show(
        <EditPermissionsModal
          selected={options.selected} path={options.path}
        />
    );
};

export const copyItem = (setClipboard, sourcePath) => {
    setClipboard(sourcePath);
};

export const pasteItem = (clipboard, targetPath, asSymlink, addAlert) => {
    spawnPaste(clipboard, targetPath, asSymlink, addAlert);
};

export const ConfirmDeletionDialog = ({
    itemPath,
    path,
    selected,
    setHistory,
    setHistoryIndex,
    setSelected,
    currentDirectory
}) => {
    const Dialogs = useDialogs();

    let modalTitle;
    if (selected.length > 1) {
        modalTitle = cockpit.format(_("Delete $0 items?"), selected.length);
    } else {
        const selectedItem = selected.length === 1
            ? selected[0]
            : currentDirectory;
        if (selectedItem.type === "reg") {
            modalTitle = cockpit.format(_("Delete file $0?"), selectedItem.name);
        } else if (selectedItem.type === "lnk") {
            modalTitle = cockpit.format(_("Delete link $0?"), selectedItem.name);
        } else if (selectedItem.type === "dir" || selectedItem.items_cnt) {
            modalTitle = cockpit.format(_("Delete directory $0?"), selectedItem.name);
        } else {
            modalTitle = cockpit.format(_("Delete $0?"), selectedItem.name);
        }
    }

    const deleteItem = () => {
        spawnDeleteItem({ Dialogs, selected, itemPath, path, setHistory, setHistoryIndex, setSelected });
    };

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
          variant={ModalVariant.small}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button variant="danger" onClick={deleteItem}>{_("Delete")}</Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
              </>
          }
        />
    );
};

export const ForceDeleteModal = ({ selected, itemPath, initialError }) => {
    const Dialogs = useDialogs();
    const [errorMessage, setErrorMessage] = useState(initialError);
    const [deleteFailed, setDeleteFailed] = useState(false);

    let modalTitle;
    if (selected.length > 1)
        modalTitle = cockpit.format(_("Force delete $0 items?"), selected.length);
    else {
        const selectedItem = Array.isArray(selected)
            ? selected[0]
            : selected;
        if (selectedItem.type === "reg") {
            modalTitle = cockpit.format(_("Force delete file $0?"), selectedItem.name);
        } else if (selectedItem.type === "lnk") {
            modalTitle = cockpit.format(_("Force delete link $0?"), selectedItem.name);
        } else if (selectedItem.type === "dir" || selectedItem.items_cnt) {
            modalTitle = cockpit.format(_("Force delete directory $0?"), selectedItem.name);
        } else {
            modalTitle = _("Force delete $0?", selectedItem.name);
        }
    }

    const forceDeleteItem = () => {
        spawnForceDelete({ Dialogs, selected, itemPath, setDeleteFailed, setErrorMessage });
    };

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
          isOpen
          onClose={Dialogs.close}
          footer={!deleteFailed &&
          <>
              <Button variant="danger" onClick={forceDeleteItem}>{_("Force delete")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <InlineNotification
              type="danger"
              text={errorMessage}
              isInline
            />
        </Modal>
    );
};

export const CreateDirectoryModal = ({ selected, currentPath }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");
    const [errorMessage, setErrorMessage] = useState(undefined);
    const createDirectory = () => {
        spawnCreateDirectory({ Dialogs, selected, currentPath, name, setErrorMessage });
    };

    return (
        <Modal
          position="top"
          title={_("Create directory")}
          isOpen
          onClose={Dialogs.close}
          footer={errorMessage === undefined &&
          <>
              <Button variant="primary" onClick={createDirectory}>{_("Create")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form
                  isHorizontal onSubmit={e => {
                      createDirectory();
                      e.preventDefault();
                      return false;
                  }}
                >
                    <FormGroup label={_("Directory name")}>
                        <TextInput
                          value={name} onChange={(_, val) => setName(val)}
                          id="create-directory-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

export const RenameItemModal = ({ path, selected, setHistory, setHistoryIndex }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState(selected.name);
    const [errorMessage, setErrorMessage] = useState(undefined);

    let title;
    if (selected.type === "reg") {
        title = cockpit.format(_("Rename file $0"), selected.name);
    } else if (selected.type === "lnk") {
        title = cockpit.format(_("Rename link $0"), selected.name);
    } else if (selected.type === "dir" || selected.items_cnt) {
        title = cockpit.format(_("Rename directory $0"), selected.name);
    } else {
        title = _("Rename $0", selected.name);
    }

    const renameItem = () => {
        spawnRenameItem({ Dialogs, path, selected, name, setErrorMessage, setHistory, setHistoryIndex });
    };

    return (
        <Modal
          position="top"
          title={title}
          variant={ModalVariant.medium}
          isOpen
          onClose={Dialogs.close}
          footer={errorMessage === undefined &&
          <>
              <Button variant="primary" onClick={renameItem}>{_("Rename")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    <FormGroup label={_("New name")}>
                        <TextInput
                          value={name} onChange={(_, val) => setName(val)}
                          id="rename-item-input"
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

export const CreateLinkModal = ({ currentPath, selected }) => {
    const Dialogs = useDialogs();
    const [originalName, setOriginalName] = useState(selected?.name || "");
    const [newName, setNewName] = useState("");
    const [type, setType] = useState("symbolic");
    const [errorMessage, setErrorMessage] = useState(undefined);

    const createLink = () => {
        spawnCreateLink({ Dialogs, currentPath, type, originalName, newName, setErrorMessage });
    };

    return (
        <Modal
          position="top"
          title={_("New link")}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button variant="primary" onClick={createLink}>{_("Create link")}</Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
              </>
          }
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    <FormGroup label={_("Original")}>
                        <div id="create-link-original-wrapper">
                            <FileAutoComplete
                              onChange={setOriginalName} placeholder={_("Path to file")}
                              superuser="try" value={currentPath + originalName}
                              id="create-link-original"
                            />
                        </div>
                    </FormGroup>
                    <FormGroup label={_("New")}>
                        <TextInput
                          value={newName} onChange={(_, val) => setNewName(val)}
                          id="create-link-new"
                        />
                    </FormGroup>
                    <FormGroup label={_("Link type")} isInline>
                        <Radio
                          name="create-link-type" label={_("Symbolic")}
                          value="symbolic" onChange={() => { setType("symbolic") }}
                          id="create-link-symbolic" isChecked={type === "symbolic"}
                        />
                        <Radio
                          name="create-link-type" label={_("Hard")}
                          value="new" onChange={() => { setType("hard") }}
                          id="create-link-hard" isChecked={type === "hard"}
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

export const EditPermissionsModal = ({ selected, path }) => {
    const Dialogs = useDialogs();
    const [owner, setOwner] = useState(selected.user);
    const [mode, setMode] = useState(selected.mode);
    const [group, setGroup] = useState(selected.group);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const accounts = useFile("/etc/passwd", { syntax: etcPasswdSyntax });
    const groups = useFile("/etc/group", { syntax: etcGroupSyntax });
    const logindef = useFile("/etc/login.defs", { superuser: true });

    //  Handle also the case where logindef == null, i.e. the file does not exist.
    //  While that's unusual, "empty /etc" is a goal, and it shouldn't crash the page.
    const [minGid, setMinGid] = useState(500);
    const [maxGid, setMaxGid] = useState(60000);
    const [minUid, setMinUid] = useState(500);
    const [maxUid, setMaxUid] = useState(60000);
    useEffect(() => {
        if (!logindef)
            return;

        const minGid = parseInt(logindef.match(/^GID_MIN\s+(\d+)/m)[1]);
        const maxGid = parseInt(logindef.match(/^GID_MAX\s+(\d+)/m)[1]);
        const minUid = parseInt(logindef.match(/^UID_MIN\s+(\d+)/m)[1]);
        const maxUid = parseInt(logindef.match(/^UID_MAX\s+(\d+)/m)[1]);

        if (minGid)
            setMinGid(minGid);
        if (maxGid)
            setMaxGid(maxGid);
        if (minUid)
            setMinUid(minUid);
        if (maxUid)
            setMaxUid(maxUid);
    }, [logindef]);

    let filteredAccounts, filteredGroups;
    if (accounts && groups) {
        filteredAccounts = accounts.filter(a => a.uid >= minUid && a.uid <= maxUid);
        filteredGroups = groups.filter(g => g.gid >= minGid && g.gid <= maxGid);
    }

    const changeOwner = (owner) => {
        setOwner(owner);
        const currentOwner = filteredAccounts.find(a => a.name === owner);
        const currentGroup = filteredGroups.find(g => g.name === group);
        if (currentGroup?.gid !== currentOwner?.gid && !currentGroup?.userlist.includes(currentOwner?.name)) {
            setGroup(filteredGroups.find(g => g.gid === currentOwner.gid).name);
        }
    };

    const options = {
        Dialogs,
        group,
        mode,
        owner,
        path,
        selected,
        setErrorMessage
    };

    function permissions_options() {
        return [
            ...map_permissions((value, label) => (
                <FormSelectOption
                  key={value}
                  value={value}
                  label={label}
                />
            ))
        ];
    }

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          /* Translators: $0 represents a filename */
          title={cockpit.format(_("“$0” permissions"), selected.name)}
          description={inode_types[selected.type] || "Unknown type"}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={() => spawnEditPermissions({ ...options, changeAll: false })}
                  >
                      {_("Change")}
                  </Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
              </>
          }
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    <FormSection title={_("Ownership")}>
                        <FormGroup label={_("Owner")} fieldId="edit-permissions-owner">
                            <FormSelect
                              onChange={(_, val) => changeOwner(val)} id="edit-permissions-owner"
                              value={owner}
                            >
                                {filteredAccounts?.map(a => {
                                    return (
                                        <FormSelectOption
                                          key={a.name} label={a.name}
                                          value={a.name}
                                        />
                                    );
                                })}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup label={_("Group")} fieldId="edit-permissions-group">
                            <FormSelect
                              onChange={(_, val) => setGroup(val)} id="edit-permissions-group"
                              value={group}
                            >
                                {filteredGroups?.map(g => {
                                    return (
                                        <FormSelectOption
                                          key={g.name} label={g.name}
                                          value={g.name}
                                        />
                                    );
                                })}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>
                    <FormSection title={_("Access")}>
                        <FormGroup
                          label={_("Owner access")}
                          fieldId="edit-permissions-owner-access"
                        >
                            <FormSelect
                              value={(mode >> 6) & 7}
                              onChange={(_, val) => { setMode((mode & 0o077) | (val << 6)) }}
                              id="edit-permissions-owner-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Group access")}
                          fieldId="edit-permissions-group-access"
                        >
                            <FormSelect
                              value={(mode >> 3) & 7}
                              onChange={(_, val) => { setMode((mode & 0o707) | (val << 3)) }}
                              id="edit-permissions-group-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Others access")}
                          fieldId="edit-permissions-other-access"
                        >
                            <FormSelect
                              value={mode & 7}
                              onChange={(_, val) => { setMode((mode & 0o770) | val) }}
                              id="edit-permissions-other-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>
                </Form>
            </Stack>
        </Modal>
    );
};

export const downloadFile = (currentPath, selected) => {
    const query = window.btoa(JSON.stringify({
        payload: "fsread1",
        binary: "raw",
        path: `${currentPath}/${selected.name}`,
        superuser: "try",
        external: {
            "content-disposition": `attachment; filename="${selected.name}"`,
            "content-type": "application/octet-stream",
        }
    }));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`, '_blank');
};
