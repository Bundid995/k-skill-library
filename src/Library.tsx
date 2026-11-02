'use client';
import { useEffect, useRef, useState, useId } from 'react';
import { BookOpen, Plus, Search, ArrowDownToLine, ArrowUpRight, Layers, Terminal, Code2, PenTool, Sparkles, X, Upload, FileText, Check, Copy, ChevronRight, Library, ShieldCheck, Trash2 } from 'lucide-react';
type Skill = {
    id: string;
    name: string;
    description: string;
    category: string;
    usage: string;
    providers: string[];
    filename: string;
    size: number;
    createdAt: string;
    download: string;
};
const categories = ['All skills', 'Development', 'Writing', 'Research', 'Design', 'Productivity', 'Other'];
const tools = ['Codex', 'Claude Code', 'Gemini CLI', 'Cursor', 'Other assistants'];
const guides: Record<string, {
    path: string;
    steps: string[];
    url: string;
    label: string;
}> = {
    'Codex': { path: '.agents/skills/your-skill/SKILL.md', steps: ['Download the skill. If it is a ZIP, extract it and keep all supporting files together.', 'Place the skill folder inside .agents/skills/ in your project. For personal use, place it in ~/.agents/skills/.', 'Start a new Codex session and explicitly ask it to use the skill by name. Review any requested tools or permissions.'], url: 'https://learn.chatgpt.com/docs/build-skills', label: 'Codex skill documentation' },
    'Claude Code': { path: '.claude/skills/your-skill/SKILL.md', steps: ['Download and extract the complete skill folder.', 'Put it in .claude/skills/ in your project, or ~/.claude/skills/ for personal use. The entry file must be named SKILL.md.', 'Open Claude Code and run /skill-name. Supporting scripts and tools may need their own setup.'], url: 'https://code.claude.com/docs/en/skills', label: 'Claude Code documentation' },
    'Gemini CLI': { path: '.gemini/skills/your-skill/SKILL.md', steps: ['Download and extract the skill, preserving its supporting files.', 'Place its folder in .gemini/skills/ in a trusted project, or ~/.gemini/skills/ for personal use. SKILL.md needs YAML name and description fields.', 'Run /skills reload, then /skills list. Ask Gemini to use the skill and review its activation request.'], url: 'https://geminicli.com/docs/cli/using-agent-skills/', label: 'Gemini CLI documentation' },
    'Cursor': { path: '.cursor/skills/your-skill/SKILL.md', steps: ['Download and extract the complete skill folder.', 'Put the folder in .cursor/skills/ in your project, or ~/.cursor/skills/ for personal use. Keep SKILL.md and referenced files together.', 'Open Agent and invoke /skill-name or attach it with @. Check that required external tools are available.'], url: 'https://cursor.com/help/customization/skills', label: 'Cursor documentation' },
    'Other assistants': { path: 'Manual use · no universal installation path', steps: ['Download and read SKILL.md. Check which tools, files, and permissions it requires.', 'If your assistant supports attachments, upload the instructions and relevant supporting files. Otherwise paste the instructions into the conversation.', 'Ask the assistant to follow the skill for your task. This is manual context use; scripts, tools, and provider-specific behavior are not guaranteed.'], url: 'https://agentskills.io/home', label: 'About the Agent Skills format' }
};
const iconFor = (cat: string) => cat === 'Development' ? Code2 : cat === 'Writing' ? PenTool : cat === 'Design' ? Sparkles : cat === 'Research' ? Search : Layers;
const size = (n: number) => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
function Modal({ title, close, children, kind = "detail" }: {
    title: string;
    close: () => void;
    children: React.ReactNode;
    kind?: "upload" | "detail";
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => { const d = ref.current; const previous = document.activeElement as HTMLElement; d?.showModal(); return () => { d?.close(); previous?.focus(); }; }, []);
    return <dialog ref={ref} className={"modal " + kind + "-modal"} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close(); }} onClick={e => {
            if (e.target === e.currentTarget)
                close();
        }}><div className="modal-head"><div><span className="modal-kicker">{kind === "upload" ? "ADD TO COLLECTION" : "SKILL DETAILS"}</span><h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}
function Installation({ provider, setProvider, showProvider = true }: {
    provider: string;
    setProvider: (v: string) => void;
    showProvider?: boolean;
}) {
    const g = guides[provider];
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    useEffect(() => { setCopied(false); setCopyError(false); }, [provider]);
    return <>{showProvider && <><label className="field-label" htmlFor="install-provider">INSTALL IN</label><select id="install-provider" value={provider} onChange={e => { setProvider(e.target.value); setCopied(false); setCopyError(false); }}>{tools.map(p => <option key={p}>{p}</option>)}</select></>}<div className="code-path"><code>{g.path}</code>{provider !== 'Other assistants' && <button className="icon-button" aria-label="Copy installation path" onClick={async () => {
                try {
                    await navigator.clipboard.writeText(g.path);
                    setCopied(true);
                    setCopyError(false);
                }
                catch {
                    setCopied(false);
                    setCopyError(true);
                }
            }}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button>}</div><p className="copy-feedback" role="status">{copied ? 'Path copied.' : copyError ? 'Copy is unavailable. Select the path above and copy it manually.' : ''}</p><ol className="steps">{g.steps.map((s, i) => <li key={s}><span>{i + 1}</span><p>{s}</p></li>)}</ol><p className="note">Replace <code>your-skill</code> with the folder name. Native skills require a valid SKILL.md with name and description frontmatter. Compatibility labels are supplied by the uploader; review each skill before use.</p><a className="text-link" href={g.url} target="_blank" rel="noreferrer">{g.label}<ArrowUpRight size={15}/></a><p className="verified">Guides checked against official documentation · 29 Oct 2026</p></>;
}
export default function Home() {
    const [items, setItems] = useState<Skill[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [query, setQuery] = useState(''), [category, setCategory] = useState('All skills'), [providerFilter, setProviderFilter] = useState('All tools'), [sort, setSort] = useState('Newest first'), [view, setView] = useState('library'), [selected, setSelected] = useState<Skill | null>(null), [tab, setTab] = useState('Overview'), [provider, setProvider] = useState('Codex');
    async function load() {
        setLoading(true); setError('');
        try {
            const response = await fetch(import.meta.env.BASE_URL + 'catalog.json');
            if (!response.ok) throw new Error('Could not load the collection. Please try again.');
            const data = await response.json();
            if (!Array.isArray(data.items)) throw new Error('The collection is unavailable.');
            setItems(data.items);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not load skills.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);
    const previousView = useRef(view);
    useEffect(() => {
        if (previousView.current !== view) {
            previousView.current = view;
            document.getElementById('page-title')?.focus();
        }
    }, [view]);
    function openSkill(s: Skill) { setSelected(s); setTab('Overview'); setProvider(s.providers.find(p => tools.includes(p)) || 'Codex'); }
    const filtered = items.filter(s => (category === 'All skills' || s.category === category) && (providerFilter === 'All tools' || s.providers.includes(providerFilter)) && `${s.name} ${s.description} ${s.category} ${s.providers.join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'A–Z' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt));
    function tabKey(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
        const names = ['Overview', 'How to use', 'Installation'];
        let next = index;
        if (e.key === 'ArrowRight')
            next = (index + 1) % names.length;
        else if (e.key === 'ArrowLeft')
            next = (index + names.length - 1) % names.length;
        else if (e.key === 'Home')
            next = 0;
        else if (e.key === 'End')
            next = names.length - 1;
        else
            return;
        e.preventDefault();
        setTab(names[next]);
        document.getElementById('tab-' + names[next].replaceAll(' ', '-'))?.focus();
    }
    return <div className="app-shell">
        <header className="app-header"><div className="header-inner"><a className="brand" href={import.meta.env.BASE_URL} aria-label="Skill Library home"><span className="brand-mark"><Layers size={24}/></span><span>skill<span className="brand-light">library</span><small>THE SHARED SKILL INDEX</small></span></a><nav className="main-nav" aria-label="Workspace"><button className={view === 'library' ? 'active' : ''} aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')}><Library size={17}/>Browse skills</button><button className={view === 'guides' ? 'active' : ''} aria-current={view === 'guides' ? 'page' : undefined} onClick={() => setView('guides')}><Terminal size={17}/>Installation guides</button></nav><span className="privacy-status"><ShieldCheck size={15}/><span>Public skill library</span></span></div></header>
        <main className="content"><header className="page-heading"><div><p className="eyebrow"><span /> {view === 'library' ? 'SKILL COLLECTION' : 'THE SETUP DESK'}</p><h1 id="page-title" tabIndex={-1}>{view === 'library' ? <>A place for your<br className="title-break"/> next capability.</> : <>From saved file<br className="title-break"/> to useful skill.</>}</h1><p>{view === 'library' ? 'Good instructions, always within reach.' : 'Choose your tool. Follow the steps. Make it yours.'}</p></div><a className="secondary" href={import.meta.env.VITE_REPOSITORY_URL || 'https://github.com'} target="_blank" rel="noreferrer"><ArrowUpRight size={17}/>Publish on GitHub</a></header>
        {view === 'guides' ? <div className="guide-workspace"><aside className="provider-rail"><p className="rail-heading">CHOOSE YOUR TOOL</p><nav aria-label="Installation provider">{tools.map(p => <button key={p} className={p === provider ? 'provider-item selected' : 'provider-item'} aria-pressed={p === provider} onClick={() => setProvider(p)}><span className="provider-letter" aria-hidden="true">{p === 'Other assistants' ? '+' : p.slice(0, 1)}</span><span>{p}</span><ChevronRight size={15}/></button>)}</nav><div className="rail-note"><FileText size={18}/><p>One entry point.<br /><strong>SKILL.md</strong></p><small>Keep the complete skill folder together, including scripts and references.</small></div></aside><section className="guide-panel"><div className="guide-title"><span className="section-number">01 / SETUP</span><h2>Install in {provider}</h2><p>{provider === 'Other assistants' ? 'Use the skill as manual context in your conversation.' : 'Add the skill folder to your project or personal collection.'}</p></div><Installation provider={provider} setProvider={setProvider} showProvider={false}/><div className="guide-bottom"><BookOpen size={18}/><p>Skills teach an agent a particular workflow. Tool support, scripts, and permissions can differ—review each skill before use.</p></div></section></div> : <>
        <section className="library-toolbar" aria-label="Find skills"><div className="search-box"><Search size={20}/><input aria-label="Search skills" placeholder="Find a skill, a workflow, a better way…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={17}/></button>}</div><select aria-label="Filter by AI tool" value={providerFilter} onChange={e => setProviderFilter(e.target.value)}><option value="All tools">All AI tools</option>{tools.map(p => <option key={p}>{p}</option>)}</select></section>
        <div className="library-workspace"><aside className="category-rail"><p className="rail-heading">BROWSE BY CATEGORY</p><nav aria-label="Categories">{categories.map(c => { const Icon = c === 'All skills' ? Layers : iconFor(c); const count = c === 'All skills' ? items.length : items.filter(s => s.category === c).length; return <button key={c} aria-pressed={c === category} className={c === category ? 'category-item selected' : 'category-item'} onClick={() => setCategory(c)}><Icon size={16}/><span>{c}</span><small>{count}</small></button>; })}</nav><button className="rail-help" onClick={() => setView('guides')}><Terminal size={19}/><span>Ready to use a skill?<small>Find your install guide</small></span><ArrowUpRight size={15}/></button></aside>
        <section className="collection-area" aria-label="Skill collection"><div className="results-heading"><p role="status">{loading ? 'Reading your collection…' : <><strong>{query || providerFilter !== 'All tools' ? 'Search results' : category}</strong><span className="result-count">{filtered.length}</span></>}</p><select aria-label="Sort skills" value={sort} onChange={e => setSort(e.target.value)}><option>Newest first</option><option>A–Z</option></select></div>
        {error ? <div className="state-panel" role="alert"><span className="empty-icon"><X size={28}/></span><h2>Your library couldn’t load</h2><p>{error}</p><button className="secondary" onClick={() => load()}>Try again</button></div> : loading && !items.length ? <div className="state-panel" role="status"><div className="loading-dot"/><p>Opening your library…</p></div> : !filtered.length ? <section className="empty-state"><span className="empty-icon"><Layers size={34} strokeWidth={1.3}/></span><span className="section-number">{items.length ? 'NOTHING HERE YET' : 'YOUR FIRST CAPABILITY'}</span><h2>{items.length ? 'No skills match this view.' : 'The collection is on its way.'}</h2><p>{items.length ? 'Try another category, AI tool, or search term.' : 'No skills have been published yet. Check back soon, or explore the installation guides.'}</p>{items.length ? <button className="secondary" onClick={() => { setQuery(''); setCategory('All skills'); setProviderFilter('All tools'); }}>Clear filters</button> : <button className="secondary" onClick={() => setView("guides")}>Explore setup guides<ChevronRight size={16}/></button>}<span className="file-hint">.MD / .ZIP · UP TO 10 MB</span></section> : <div className="skill-grid">{filtered.map(s => { const Icon = iconFor(s.category); return <article className={'skill-card category-' + s.category.toLowerCase()} key={s.id}><div className="card-top"><span className="skill-icon"><Icon size={23} strokeWidth={1.5}/></span><span className="card-index">{/\.zip$/i.test(s.filename) ? 'ZIP ARCHIVE' : 'MARKDOWN SKILL'}</span><span className="file-orbit" aria-hidden="true"><Layers size={39} strokeWidth={.6}/></span></div><span className="card-category">{s.category}</span><button className="card-name" onClick={() => openSkill(s)}>{s.name}</button><p className="card-description">{s.description}</p><div className="tool-tags" aria-label="Compatible tools">{s.providers.length ? s.providers.slice(0, 3).map(p => <span key={p}>{p}</span>) : <span>Compatibility unspecified</span>}{s.providers.length > 3 && <span>+{s.providers.length - 3}</span>}</div><div className="card-footer"><span className="file-size">{size(s.size)}</span><button className="card-details" aria-label={'Details for ' + s.name} onClick={() => openSkill(s)}>Details<ChevronRight size={15}/></button><a className="card-download" aria-label={'Download ' + s.name} download={s.filename} href={import.meta.env.BASE_URL + s.download}><ArrowDownToLine size={16}/>Download</a></div></article>; })}</div>}
        <div className="collection-footer"><span><ShieldCheck size={14}/>Original files. Ready to download.</span><span>{items.length} {items.length === 1 ? 'skill' : 'skills'} in the collection</span></div></section></div></>}
        <footer className="app-footer"><span className="footer-mark"><Layers size={15}/> YOUR KNOW-HOW, ON HAND.</span><button className="text-link" onClick={() => setView(view === 'library' ? 'guides' : 'library')}>{view === 'library' ? 'Explore installation guides' : 'Back to your library'}<ArrowUpRight size={15}/></button></footer></main>
        {selected && <Modal title={selected.name} close={() => setSelected(null)}><div className="detail-meta"><span className="category-label">{selected.category}</span><span>Added {new Date(selected.createdAt).toLocaleDateString('en-GB')}</span></div><div className="detail-layout"><aside className="detail-file"><span className="file-emblem"><FileText size={35} strokeWidth={1.2}/></span><span className="section-number">ORIGINAL FILE</span><strong>{selected.filename}</strong><small>{size(selected.size)}</small><a className="primary" download={selected.filename} href={import.meta.env.BASE_URL + selected.download}><ArrowDownToLine size={17}/>Download</a><span className="download-note">Full file, exactly as uploaded.</span></aside><div className="detail-body"><div className="tabs" role="tablist" aria-label="Skill details">{['Overview', 'How to use', 'Installation'].map((t, i) => <button role="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onKeyDown={e => tabKey(e, i)} aria-controls="detail-panel" id={'tab-' + t.replaceAll(' ', '-')} key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}</button>)}</div><div className="tab-panel" id="detail-panel" role="tabpanel" tabIndex={0} aria-labelledby={'tab-' + tab.replaceAll(' ', '-')}>{tab === 'Overview' ? <><h3>What this skill does</h3><p className="detail-description">{selected.description}</p><h3>Works with</h3><div className="tool-tags">{selected.providers.length ? selected.providers.map(p => <span key={p}>{p}</span>) : <span>Not specified by uploader</span>}</div><p className="note">Compatibility is supplied by the uploader. Review the skill’s tools and permissions before use.</p></> : tab === 'How to use' ? <><h3>Usage notes</h3><p className="usage-text">{selected.usage || 'No usage notes were added. Read the downloaded SKILL.md for the intended workflow and prerequisites.'}</p><div className="example-prompt"><span className="field-label">TRY THIS REQUEST</span><p>Use the {selected.name} skill to help with my task.</p><small>Include the context and files your skill needs.</small></div></> : <Installation provider={provider} setProvider={setProvider}/>}</div></div></div></Modal>}
    </div>;
}

