import "./App.css";
import { useState, useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { downloadData, getUrl, remove, uploadData } from "aws-amplify/storage";
import { Authenticator, ThemeProvider } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";


const theme = {
  name: "dark-theme",
  tokens: {
    colors: {
      background: {
        primary: { value: "#0f172a" },
        secondary: { value: "#ffffff" },
      },
      font: {
        primary: { value: "#ffffff" },
      },
      brand: {
        primary: {
          80: { value: "#ffffff" },
          secondary: { value: "#94a3b8" }
        },
      },
    },
    components: {
      tabs:
      {
        item: {
          color: { value: "#ababab" },
          _active: {
            color: { value: "#ffffff" }
          },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: "#0f172a" },
          _hover: {
            backgroundColor: { value: "#ffffff" },
          },
        },
      },
    }
  },
};

function parseAttachmentPaths(image) {
  if (!image) return [];

  try {
    const parsed = JSON.parse(image);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [image];
  } catch {
    return [image];
  }
}

function getFileName(path) {
  return path.split("/").pop()?.replace(/^\d+-/, "") || "Załącznik";
}

function isImageFile(path) {
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(path);
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return "";

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function App({ signOut, user }) {
  const client = generateClient();
  const [notes, setNotes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [openAttachmentId, setOpenAttachmentId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedNoteId, setSavedNoteId] = useState(null);
  const [savedAttachmentPath, setSavedAttachmentPath] = useState(null);
  const [downloadedAttachmentPath, setDownloadedAttachmentPath] = useState(null);
  const [sharingNoteId, setSharingNoteId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [incomingShares, setIncomingShares] = useState([]);
  const userEmail = user?.signInDetails?.loginId;


  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    fetchIncomingShares();
  }, [userEmail]);

  useEffect(() => {
    async function loadAvatar() {
      if (!userEmail) {
        setAvatarUrl("");
        return;
      }

      const avatarPath = localStorage.getItem(`avatarPath:${userEmail}`);

      if (!avatarPath) {
        setAvatarUrl("");
        return;
      }

      try {
        const fileUrl = await getUrl({ path: avatarPath });
        setAvatarUrl(fileUrl.url.toString());
      } catch {
        setAvatarUrl("");
      }
    }

    loadAvatar();
  }, [userEmail]);



  useEffect(() => {
    function handleClickOutside() {
      setEditingId(null);
      setEditingTitleId(null);
      setSharingNoteId(null);
      setOpenAttachmentId(null);
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);




  async function fetchNotes() {
    const { data } = await client.models.Note.list();
    const sorted = [...data].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const withImageUrls = await Promise.all(
      sorted.map(async (n) => {
        const attachments = await Promise.all(
          parseAttachmentPaths(n.image).map(async (path) => {
            const fileUrl = await getUrl({ path });

            return {
              path,
              name: getFileName(path),
              url: fileUrl.url.toString(),
              isImage: isImageFile(path),
            };
          })
        );

        return {
          ...n,
          attachments,
        };
      })
    );
    const withAnimation = withImageUrls.map(n => ({ ...n, visible: false }));
    setNotes(withAnimation);

    setTimeout(() => {
      setNotes(prev =>
        prev.map(n => ({ ...n, visible: true }))
      );
    }, 50);
  }

  async function fetchIncomingShares() {
    if (!userEmail || !client.models.ShareRequest) return;

    const { data } = await client.models.ShareRequest.list();
    const normalizedEmail = userEmail.toLowerCase();
    const pendingShares = data.filter(
      (share) =>
        share.recipientEmail?.toLowerCase() === normalizedEmail &&
        share.status === "pending"
    );

    setIncomingShares(pendingShares);
  }

  async function addNote() {
    const { data: newNote } = await client.models.Note.create({
      name: "Nowa notatka",
      description: ""
    });

    await fetchNotes();
    setEditingId(newNote.id);
    setTitleInput(newNote.name || "Nowa notatka");
    setDescriptionInput("");
  }

  async function deleteNote(id) {
    setDeletingId(id);

    setTimeout(async () => {
      await client.models.Note.delete({ id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setDeletingId(null);
    }, 300);
  }

  async function updateNote() {
    if (!editingId) return;
    const noteId = editingId;

    await client.models.Note.update({
      id: noteId,
      name: titleInput.trim() || "Nowa notatka",
      description: descriptionInput,
    });

    setEditingTitleId(null);
    setSavedNoteId(noteId);
    await fetchNotes();

    setTimeout(() => {
      setSavedNoteId((currentId) => (currentId === noteId ? null : currentId));
    }, 1200);
  }

  async function updateNoteTitle(noteId) {
    const trimmedTitle = titleInput.trim();
    if (!noteId || !trimmedTitle) return;

    await client.models.Note.update({
      id: noteId,
      name: trimmedTitle,
    });

    setEditingTitleId(null);
    fetchNotes();
  }

  async function shareNote(note) {
    const recipientEmail = shareEmail.trim().toLowerCase();
    if (!note?.id || !recipientEmail || !userEmail) return;

    await client.models.ShareRequest.create({
      senderEmail: userEmail,
      recipientEmail,
      name: note.name,
      description: note.description || "",
      image: note.image || "",
      status: "pending",
    });

    setShareEmail("");
    setSharingNoteId(null);
  }

  async function acceptShare(share) {
    await client.models.Note.create({
      name: share.name,
      description: share.description || "",
      image: share.image || "",
    });

    await client.models.ShareRequest.update({
      id: share.id,
      status: "accepted",
    });

    fetchIncomingShares();
    fetchNotes();
  }

  async function uploadFile(file) {
    if (!editingId || !file) return;

    const safeName = file.name.replaceAll(" ", "_");
    const uploadResult = await uploadData({
      path: ({ identityId }) => `media/${identityId}/${Date.now()}-${safeName}`,
      data: file,
    }).result;
    const currentNote = notes.find((note) => note.id === editingId);
    const currentAttachments = parseAttachmentPaths(currentNote?.image);

    await client.models.Note.update({
      id: editingId,
      image: JSON.stringify([...currentAttachments, uploadResult.path]),
    });

    setSavedAttachmentPath(uploadResult.path);
    await fetchNotes();

    setTimeout(() => {
      setSavedAttachmentPath((currentPath) =>
        currentPath === uploadResult.path ? null : currentPath
      );
    }, 1200);
  }

  async function uploadAvatar(file) {
    if (!file || !userEmail) return;

    const safeName = file.name.replaceAll(" ", "_");
    const uploadResult = await uploadData({
      path: ({ identityId }) => `media/${identityId}/avatar/${Date.now()}-${safeName}`,
      data: file,
    }).result;

    localStorage.setItem(`avatarPath:${userEmail}`, uploadResult.path);

    const fileUrl = await getUrl({ path: uploadResult.path });
    setAvatarUrl(fileUrl.url.toString());
  }

  async function deleteAttachment(note, attachmentPath) {
    if (!note?.id || !attachmentPath) return;

    await remove({ path: attachmentPath });

    const updatedAttachments = parseAttachmentPaths(note.image).filter(
      (path) => path !== attachmentPath
    );

    await client.models.Note.update({
      id: note.id,
      image: updatedAttachments.length ? JSON.stringify(updatedAttachments) : "",
    });

    setOpenAttachmentId((currentId) =>
      currentId === attachmentPath ? null : currentId
    );
    setSavedAttachmentPath((currentPath) =>
      currentPath === attachmentPath ? null : currentPath
    );
    fetchNotes();
  }

  async function downloadAttachment(attachment) {
    if (!attachment?.path) return;
    if (downloadedAttachmentPath === attachment.path) return;

    setDownloadedAttachmentPath(attachment.path);

    const { body } = await downloadData({ path: attachment.path }).result;
    const blob = await body.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = attachment.name || "zalacznik";
    link.addEventListener("click", (event) => event.stopPropagation());
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setDownloadedAttachmentPath((currentPath) =>
        currentPath === attachment.path ? null : currentPath
      );
    }, 1200);
  }

  return (
    <div className="layout">

      <div className="sidebar">
        <div className="avatarSection" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="avatar"
            onClick={() => avatarInputRef.current?.click()}
            title="Zmień avatar"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar użytkownika" />
            ) : (
              userEmail?.[0]?.toUpperCase()
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="fileInput"
            onChange={(e) => {
              const file = e.target.files?.[0];
              uploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="userSection">
          <div className="email">
            {userEmail}
          </div>

          <button className="logoutBtn" onClick={signOut}>
            Wyloguj
          </button>
        </div>
        {incomingShares.length > 0 && (
          <div className="sharedNotes">
            <div className="sharedNotesTitle">Otrzymane</div>
            {incomingShares.map((share) => (
              <button
                key={share.id}
                className="sharedNoteCard"
                onClick={(e) => {
                  e.stopPropagation();
                  acceptShare(share);
                }}
              >
                <span>{share.name}</span>
                <small>od {share.senderEmail}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="container"
        onClick={() => {
          setEditingId(null);
          setEditingTitleId(null);
          setSharingNoteId(null);
          setOpenAttachmentId(null);
        }}
      >
        <h1>📝 Notes</h1>

        <button
          className="addNoteCard"
          onClick={(e) => {
            e.stopPropagation();
            addNote();
          }}
        >
          Dodaj notatkę
        </button>

        <div className="notesList" ref={listRef}>
          {notes.map((n) => (
            <div
              className={`noteCard 
              ${n.visible ? "show" : ""}
              ${editingId === n.id ? "active" : ""} 
              ${deletingId === n.id ? "removing" : ""}`}
              key={n.id}
              onClick={(e) => {
                e.stopPropagation();
                if (editingId === n.id) {
                  setEditingId(null);
                  setEditingTitleId(null);
                  setOpenAttachmentId(null);
                  return;
                }

                setEditingId(n.id);
                setTitleInput(n.name || "");
                setEditingTitleId(null);
                setOpenAttachmentId(null);
                setDescriptionInput(n.description || "");
              }}
            >

              {/* HEADER */}
              <div className="noteHeader">
                <div className="noteTitle">
                  {editingTitleId === n.id ? (
                    <input
                      ref={titleInputRef}
                      className="noteTitleInput"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => updateNoteTitle(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          updateNoteTitle(n.id);
                        }

                        if (e.key === "Escape") {
                          setEditingTitleId(null);
                          setTitleInput(n.name || "");
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="noteTitleText"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(n.id);
                        setTitleInput(n.name || "");
                        setDescriptionInput(n.description || "");
                        if (editingId !== n.id) return;

                        setEditingTitleId(n.id);
                        setTimeout(() => titleInputRef.current?.focus(), 0);
                      }}
                    >
                      {n.name}
                    </span>
                  )}
                  <time dateTime={n.createdAt}>{formatCreatedAt(n.createdAt)}</time>
                </div>

                <div className="noteActions">
                  {editingId === n.id && (
                    <button
                      className={savedNoteId === n.id ? "savedBtn" : ""}
                      disabled={savedNoteId === n.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNote();
                      }}
                    >
                      {savedNoteId === n.id ? "OK" : "Zapisz"}
                    </button>
                  )}
                  {editingId === n.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSharingNoteId((currentId) =>
                          currentId === n.id ? null : n.id
                        );
                        setShareEmail("");
                      }}
                    >
                      Udostępnij
                    </button>
                  )}
                  {editingId === n.id && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="*/*"
                        className="fileInput"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          uploadFile(file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        Dodaj plik
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(n.id);
                    }}
                  >
                    ❌
                  </button>
                </div>
              </div>
              {editingId === n.id && sharingNoteId === n.id && (
                <div className="shareBox" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="Email odbiorcy"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      shareNote(n);
                    }}
                  >
                    OK
                  </button>
                </div>
              )}
              {editingId === n.id && (
                <textarea
                  className={`noteTextarea ${editingId === n.id ? "open" : ""}`}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }
                  }}
                  value={descriptionInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDescriptionInput(value);
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Dodaj opis..."
                />
              )}
              {editingId === n.id && n.attachments?.map((attachment, index) => (
                <div key={attachment.path}>
                    <div
                      className={`attachmentCard ${
                        savedAttachmentPath === attachment.path ? "savedAttachment" : ""
                      } ${attachment.isImage ? "" : "noPreview"}`}
                      role={attachment.isImage ? "button" : undefined}
                      tabIndex={attachment.isImage ? 0 : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!attachment.isImage) return;

                        setOpenAttachmentId((currentId) =>
                          currentId === attachment.path ? null : attachment.path
                        );
                      }}
                      onKeyDown={(e) => {
                        if (!attachment.isImage) return;
                        if (e.key !== "Enter" && e.key !== " ") return;

                        e.preventDefault();
                        e.stopPropagation();
                        setOpenAttachmentId((currentId) =>
                          currentId === attachment.path ? null : attachment.path
                        );
                      }}
                    >
                    <span>{attachment.name}</span>
                    <span className="attachmentActions">
                      {attachment.isImage ? (
                        <span className="attachmentActionLabel">
                          {openAttachmentId === attachment.path ? "Ukryj" : "Podgląd"}
                        </span>
                      ) : (
                        <span className="attachmentFileLabel">Plik</span>
                      )}
                      <button
                        type="button"
                        className={`attachmentDownload ${
                          downloadedAttachmentPath === attachment.path
                            ? "downloadedAttachment"
                            : ""
                        }`}
                        disabled={downloadedAttachmentPath === attachment.path}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadAttachment(attachment);
                        }}
                        title="Pobierz załącznik"
                      >
                        {downloadedAttachmentPath === attachment.path
                          ? "Pobrano"
                          : "Pobierz"}
                      </button>
                      <span
                        className="attachmentDelete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAttachment(n, attachment.path);
                        }}
                        title="Usuń załącznik"
                      >
                        X
                      </span>
                    </span>
                  </div>

                  {attachment.isImage && openAttachmentId === attachment.path && (
                    <img
                      className="noteImage"
                      src={attachment.url}
                      alt={`${n.name || "Załącznik"} ${index + 1}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export default function AppWrapper() {
  return (

    <ThemeProvider theme={theme}>
      <Authenticator
        components={{
          Header() {
            return (
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h2>📝 Notes</h2>
                <p>Zaloguj się, aby kontynuować</p>
              </div>
            );
          },
        }}
      >
        {({ signOut, user }) => (
          <App signOut={signOut} user={user} />
        )}
      </Authenticator>
    </ThemeProvider>
  )
};
