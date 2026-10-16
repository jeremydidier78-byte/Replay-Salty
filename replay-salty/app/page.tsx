"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";

type Replay = {
  id: string; title: string; game: string; format: string | null;
  player_one: string | null; player_two: string | null; description: string | null;
  replay_url: string | null; file_path: string | null; created_at: string;
  profiles?: { username: string | null } | null;
};
type Profile = { id: string; username: string | null; avatar_url: string | null };
const GAMES = [
  "Pokémon Rouge / Bleu / Jaune", "Pokémon Or / Argent / Cristal", "Pokémon Rubis / Saphir / Émeraude",
  "Pokémon Diamant / Perle / Platine", "Pokémon Noir / Blanc", "Pokémon X / Y", "Pokémon Soleil / Lune",
  "Pokémon Épée / Bouclier", "Pokémon Écarlate / Violet", "Pokémon Let's Go", "Pokémon Legends: Arceus",
  "Pokémon Champions", "Pokémon Showdown", "Pokémon GO", "Pokémon TCG / JCC", "Autre jeu Pokémon"
];

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [replays, setReplays] = useState<Replay[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [showAuth, setShowAuth] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadReplays() {
    const { data, error } = await supabase.from("replays")
      .select("id,title,game,format,player_one,player_two,description,replay_url,file_path,created_at,profiles(username)")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(100);
    if (error) setNotice(error.message); else setReplays((data ?? []) as unknown as Replay[]);
  }
  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (user) {
      const { data } = await supabase.from("profiles").select("id,username,avatar_url").eq("id", user.id).maybeSingle();
      setProfile(data as Profile | null);
      if (data?.username) setUsername(data.username);
    } else setProfile(null);
  }
  useEffect(() => {
    loadUser(); loadReplays();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { loadUser(); });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const filtered = useMemo(() => replays.filter(r =>
    (!gameFilter || r.game === gameFilter) &&
    [r.title, r.game, r.format, r.player_one, r.player_two, r.description, r.profiles?.username]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  ), [replays, gameFilter, search]);

  async function authSubmit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (data.session) {
          await supabase.from("profiles").upsert({ id: data.user!.id, username });
          setNotice("Compte créé ! Bienvenue sur Replay Salty.");
        } else setNotice("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setNotice("Connexion réussie !");
      }
      await loadUser(); setShowAuth(false);
    } catch (err) { setNotice(err instanceof Error ? err.message : "Une erreur est survenue."); }
    finally { setBusy(false); }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); if (!userId) return;
    setBusy(true);
    const clean = username.trim();
    if (clean.length < 3 || clean.length > 24) { setNotice("Le pseudo doit contenir de 3 à 24 caractères."); setBusy(false); return; }
    const { error } = await supabase.from("profiles").upsert({ id: userId, username: clean });
    setNotice(error ? error.message : "Profil mis à jour.");
    if (!error) { setProfile({ id: userId, username: clean, avatar_url: profile?.avatar_url ?? null }); }
    setBusy(false);
  }

  async function addReplay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!userId) { setShowAuth(true); return; }
    setBusy(true); setNotice("");
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    const game = String(form.get("game") || "");
    const urlRaw = String(form.get("replay_url") || "").trim();
    const file = form.get("replay_file");
    let replayUrl: string | null = null, filePath: string | null = null;
    try {
      if (urlRaw) {
        const parsed = new URL(urlRaw);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Le lien doit commencer par https:// ou http://.");
        replayUrl = parsed.toString();
      }
      if (file instanceof File && file.size > 0) {
        if (file.size > 50 * 1024 * 1024) throw new Error("Fichier trop volumineux : limite actuelle de 50 Mo.");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("replay-files").upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }
      if (!replayUrl && !filePath) throw new Error("Ajoute un lien de replay ou sélectionne un fichier.");
      const { error } = await supabase.from("replays").insert({
        user_id: userId, title, game, format: String(form.get("format") || "") || null,
        player_one: String(form.get("player_one") || "") || null,
        player_two: String(form.get("player_two") || "") || null,
        description: String(form.get("description") || "") || null,
        replay_url: replayUrl, file_path: filePath, visibility: "public"
      });
      if (error) {
        if (filePath) await supabase.storage.from("replay-files").remove([filePath]);
        throw error;
      }
      setShowForm(false); (e.target as HTMLFormElement).reset(); setNotice("Replay publié !");
      await loadReplays();
    } catch (err) { setNotice(err instanceof Error ? err.message : "Impossible de publier ce replay."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await supabase.auth.signOut(); setUserId(null); setProfile(null); setNotice("Tu es déconnecté.");
  }
  async function openReplay(r: Replay) {
    if (r.replay_url) window.open(r.replay_url, "_blank", "noopener,noreferrer");
    else if (r.file_path) {
      const { data } = supabase.storage.from("replay-files").getPublicUrl(r.file_path);
      if (data?.publicUrl) window.open(data.publicUrl, "_blank", "noopener,noreferrer");
    }
  }

  return <main>
    <header className="topbar"><a className="brand" href="#"><span className="brand-ball">●</span><span>Poké<span>Replay</span></span></a>
      <nav><a href="#replays">Replays</a><a href="#how">Comment ça marche</a></nav>
      <div className="header-actions">{userId ? <><span className="signed-in">👋 {profile?.username || "Dresseur"}</span><button className="btn btn-light" onClick={() => setShowForm(true)}>＋ Publier</button><button className="btn btn-quiet" onClick={signOut}>Déconnexion</button></> : <button className="btn btn-light" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}>Connexion / Inscription</button>}</div>
    </header>

    <section className="hero"><div className="hero-copy"><div className="eyebrow">✦ Le terrain de jeu des dresseurs</div>
      <h1>Ton combat.<br/><span>Ta légende.</span></h1>
      <p>Partage tes meilleurs matchs, découvre les stratégies de la communauté et retrouve des replays de toutes les générations Pokémon.</p>
      <div className="hero-buttons"><button className="btn btn-primary" onClick={() => userId ? setShowForm(true) : setShowAuth(true)}>⚡ Publier un replay</button><a className="btn btn-white" href="#replays">Explorer les matchs ↓</a></div>
      <div className="hero-note"><span>🎮</span> Des classiques aux jeux les plus récents</div>
    </div><div className="hero-visual"><div className="sunburst"></div><div className="hero-orb"><div className="orb-center"></div></div><div className="floating f-one">⚡ Prêt au combat ?</div><div className="floating f-two">🏆 GG !</div><span className="star star-one">✦</span><span className="star star-two">✧</span></div></section>

    <section className="mini-stats"><div><b>{replays.length}</b><span>Replays publics</span></div><div><b>∞</b><span>Possibilités de combat</span></div><div><b>🌍</b><span>Une communauté</span></div></section>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

    <section className="section" id="replays"><div className="section-heading"><div><span className="eyebrow">À l'affiche</span><h2>Les derniers combats</h2><p>La prochaine pépite pourrait être la tienne.</p></div><button className="btn btn-primary" onClick={() => userId ? setShowForm(true) : setShowAuth(true)}>＋ Ajouter mon match</button></div>
      <div className="filters"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 Rechercher un match, un pseudo…" aria-label="Recherche"/><select value={gameFilter} onChange={e => setGameFilter(e.target.value)} aria-label="Filtrer par jeu"><option value="">Tous les jeux</option>{GAMES.map(g => <option key={g}>{g}</option>)}</select></div>
      <div className="replay-grid">{filtered.length ? filtered.map((r, i) => <article className="replay-card" key={r.id}><div className={`card-art art-${i % 4}`}><span className="game-badge">{r.game}</span><span className="art-emoji">{["⚡","🔥","💧","🌿"][i%4]}</span><span className="card-format">{r.format || "Combat Pokémon"}</span></div><div className="card-content"><h3>{r.title}</h3><p className="players">{r.player_one || "Dresseur 1"} <b>VS</b> {r.player_two || "Dresseur 2"}</p><p className="description">{r.description || "Un replay partagé par la communauté."}</p><div className="card-bottom"><span>👤 {r.profiles?.username || "Dresseur"}</span><button className="link-button" onClick={() => openReplay(r)}>Regarder ↗</button></div></div></article>) : <div className="empty"><span>🎮</span><h3>Aucun replay pour le moment</h3><p>Modifie ta recherche ou publie le premier match !</p></div>}</div>
    </section>

    <section className="how" id="how"><span className="eyebrow">Simple comme bonjour</span><h2>Trois étapes pour entrer dans l'arène</h2><div className="how-grid"><div><i>1</i><h3>Crée ton profil</h3><p>Choisis ton pseudo de dresseur et rejoins la communauté.</p></div><div><i>2</i><h3>Publie ton replay</h3><p>Ajoute un lien ou un fichier, le jeu et les joueurs du match.</p></div><div><i>3</i><h3>Partage la victoire</h3><p>Les autres dresseurs peuvent retrouver et regarder ton combat.</p></div></div></section>
    <footer><a className="brand" href="#"><span className="brand-ball">●</span><span>Poké<span>Replay</span></span></a><p>Projet communautaire non officiel, sans affiliation avec Nintendo, Game Freak ou The Pokémon Company.</p></footer>

    {showAuth && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAuth(false); }}><section className="modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setShowAuth(false)} aria-label="Fermer">×</button><div className="modal-icon">⚡</div><h2>{authMode === "signup" ? "Rejoins les dresseurs !" : "Content de te revoir !"}</h2><p>{authMode === "signup" ? "Crée ton compte Replay Salty." : "Connecte-toi pour publier tes combats."}</p><form onSubmit={authSubmit} className="form-stack">{authMode === "signup" && <label>Pseudo de dresseur<input required minLength={3} maxLength={24} value={username} onChange={e => setUsername(e.target.value)} placeholder="Ex. PikachuMaster"/></label>}<label>Adresse e-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="toi@exemple.fr"/></label><label>Mot de passe<input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum"/></label><button className="btn btn-primary full-btn" disabled={busy}>{busy ? "Patiente…" : authMode === "signup" ? "Créer mon compte" : "Se connecter"}</button></form><p className="switch-mode">{authMode === "signup" ? "Déjà un compte ?" : "Nouveau sur Replay Salty ?"} <button onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Connexion" : "Créer un compte"}</button></p></section></div>}

    {showForm && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}><section className="modal modal-wide" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Fermer">×</button><div className="modal-icon">🎮</div><h2>Publier un replay</h2><p>Partage ton combat avec tous les dresseurs.</p><form className="form-stack" onSubmit={addReplay}><label>Titre du match *<input name="title" required maxLength={90} placeholder="Ex. Une victoire à la dernière seconde"/></label><div className="two-fields"><label>Jeu Pokémon *<select name="game" required defaultValue=""><option value="" disabled>Choisir un jeu</option>{GAMES.map(g => <option key={g}>{g}</option>)}</select></label><label>Format / mode<input name="format" maxLength={50} placeholder="Classé, VGC, OU…"/></label></div><div className="two-fields"><label>Joueur 1<input name="player_one" maxLength={40} placeholder="Pseudo"/></label><label>Joueur 2<input name="player_two" maxLength={40} placeholder="Pseudo"/></label></div><label>Lien du replay<input name="replay_url" type="url" placeholder="https://…"/></label><label>Ou fichier du replay (50 Mo maximum)<input name="replay_file" type="file"/></label><label>Description<textarea name="description" rows={3} maxLength={240} placeholder="Le moment décisif du match…"/></label><p className="small-hint">Les liens doivent être partageables. Les formats de fichier acceptés dépendent du type de replay que tu veux héberger.</p><button className="btn btn-primary full-btn" disabled={busy}>{busy ? "Publication…" : "Publier au grand jour ✨"}</button></form></section></div>}
  </main>;
}
