import "./App.css";
import { useState, useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
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

function App({ signOut, user }) {
  const client = generateClient();
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const listRef = useRef(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [descriptionInput, setDescriptionInput] = useState("");


  useEffect(() => {
    fetchNotes();
  }, []);



  useEffect(() => {
    function handleClickOutside() {
      setEditingId(null);
      setInput("");
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
    const withAnimation = sorted.map(n => ({ ...n, visible: false }));
    setNotes(withAnimation);

    setTimeout(() => {
      setNotes(prev =>
        prev.map(n => ({ ...n, visible: true }))
      );
    }, 50);
  }

  async function addNote() {
    if (!input) return;

    await client.models.Note.create({
      name: input,
      description: ""
    });

    setInput("");
    fetchNotes();
  }

  async function deleteNote(id) {
    setDeletingId(id);

    setTimeout(async () => {
      await client.models.Note.delete({ id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setDeletingId(null);
      setInput("");
    }, 300);
  }

  async function updateNote() {
    if (!editingId) return;

    await client.models.Note.update({
      id: editingId,
      description: descriptionInput,
    });

    setInput("");
    setEditingId(null);
    fetchNotes();
  }

  return (
    <div className="layout">

      <div className="sidebar">
        <div className="avatar">
          {user?.signInDetails?.loginId?.[0]?.toUpperCase()}
        </div>
        <div className="userSection">
          <div className="email">
            {user?.signInDetails?.loginId}
          </div>

          <button className="logoutBtn" onClick={signOut}>
            Wyloguj
          </button>
        </div>
      </div>

      <div
        className="container"
        onClick={() => {
          setEditingId(null);
        }}
      >
        <h1>📝 Notes</h1>

        <div className="inputRow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Wpisz notatkę..."
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              addNote();
            }}
          >
            Dodaj
          </button>
        </div>

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
                setEditingId(n.id);
                setDescriptionInput(n.description || "");
              }}
            >

              {/* HEADER */}
              <div className="noteHeader">
                <span>{n.name}</span>

                <div className="noteActions">
                  {editingId === n.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNote();
                      }}
                    >
                      Zapisz
                    </button>
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