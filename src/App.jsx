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

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const startHeight = el.offsetHeight;
    el.style.height = startHeight + "px";

    requestAnimationFrame(() => {
      const endHeight = el.scrollHeight;
      el.style.height = endHeight + "px";
    });

    // 🔥 po animacji reset
    const timeout = setTimeout(() => {
      el.style.height = "auto";
    }, 250);

    return () => clearTimeout(timeout);

  }, [notes]);


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
    setNotes(sorted);
  }

  async function addNote() {
    if (!input) return;

    await client.models.Note.create({
      name: input,
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
    if (!input || !editingId) return;

    await client.models.Note.update({
      id: editingId,
      name: input,
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
          setInput("");
        }}
      >
        <h1>📝 Notes App</h1>

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
              editingId ? updateNote() : addNote();
            }}
          >
            {editingId ? "Zapisz" : "Dodaj"}
          </button>
        </div>

        <div className="notesList" ref={listRef}>
          {notes.map((n) => (
            <div
              className={`noteCard 
              ${editingId === n.id ? "active" : ""} 
              ${deletingId === n.id ? "removing" : ""}`}
              key={n.id}
              onClick={(e) => {
                e.stopPropagation();
                setInput(n.name);
                setEditingId(n.id);
              }}
            >
              <span
                onClick={() => {
                  setInput(n.name);
                  setEditingId(n.id);
                }}
              >
                {n.name}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
              >
                ❌
              </button>
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
                <h2>📝 Notes App</h2>
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
  );
}