from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        print(f"skip: {label} (pattern not found)")
        return text
    print(f"apply: {label}")
    return text.replace(old, new, 1)


def add_shared_assets(text: str) -> str:
    if 'href="site-extra.css"' not in text:
        text = text.replace('</head>', '<link rel="stylesheet" href="site-extra.css">\n<script src="site-extra.js" defer></script>\n</head>', 1)
    return text


def add_legal_footer(text: str) -> str:
    if 'class="site-legal-footer"' in text:
        return text
    footer = '''\n<footer class="site-legal-footer"><div class="site-legal-footer-inner"><p>Independent civic project. Not affiliated with the City of Burlington, any candidate or campaign.</p><div class="site-legal-links"><a href="help.html">Help &amp; feedback</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div></div></footer>\n'''
    return text.replace('</body>', footer + '</body>', 1)


def polish_index(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        '<title>Burlington Election Guide</title>',
        '<title>Burlington Mayoral Election Guide | Burlington, Ontario</title><meta name="description" content="An independent, plain-language guide to the 2026 Burlington, Ontario mayoral election, candidates, issues, sources and voting dates.">',
        'page title and description',
    )
    text = replace_once(
        text,
        'section{margin-bottom:32px;scroll-margin-top:86px}',
        'section{margin-bottom:38px;scroll-margin-top:86px}',
        'section spacing',
    )
    text = replace_once(
        text,
        'h1{font-family:Georgia,Times,serif;font-size:clamp(38px,5vw,54px);line-height:1;margin:0 0 18px;letter-spacing:-.03em}',
        'h1{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:clamp(38px,5vw,52px);font-weight:850;line-height:1.02;margin:0 0 28px;letter-spacing:-.035em}',
        'main h1 typography',
    )
    text = replace_once(
        text,
        'h2{font-family:Georgia,Times,serif;font-size:clamp(30px,4vw,42px);line-height:1.05;margin:0 0 10px;letter-spacing:-.025em}',
        'h2{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:clamp(28px,4vw,38px);font-weight:850;line-height:1.08;margin:0 0 12px;letter-spacing:-.03em}',
        'section h2 typography',
    )
    text = replace_once(
        text,
        '.candidate-card{position:relative;border:2px solid transparent;border-radius:16px;background:#fff;padding:0;text-align:left;cursor:pointer;box-shadow:var(--shadow);min-width:0;overflow:visible}',
        '.candidate-card{position:relative;border:2px solid transparent;border-radius:16px;background:#fff;padding:0;text-align:left;cursor:pointer;box-shadow:var(--shadow);min-width:0;overflow:visible;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}',
        'candidate card transition',
    )
    text = replace_once(
        text,
        '.candidate-body h3{font-family:Georgia,Times,serif;font-size:21px;line-height:1.02;margin:0 0 11px;letter-spacing:-.015em;overflow-wrap:anywhere}',
        '.candidate-body h3{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:20px;font-weight:820;line-height:1.08;margin:0 0 10px;letter-spacing:-.02em;overflow-wrap:anywhere}',
        'candidate name typography',
    )

    extra_css = '''
#candidates>h1{margin-bottom:30px}
@media(hover:hover){
  .candidate-card:hover{transform:translateY(-4px);box-shadow:0 15px 32px rgba(15,52,88,.14);border-color:#bad9ef}
  .candidate-card[aria-pressed="true"]:hover{border-color:#4aa9ee}
  .meaning-detail summary:hover,.source-links a:hover{text-decoration:underline}
  .h2h-link:hover{background:#164f83}
}
@media(prefers-reduced-motion:reduce){.candidate-card{transition:none}.candidate-card:hover{transform:none}}
'''
    if '#candidates>h1{margin-bottom:30px}' not in text:
        text = text.replace('</style>', extra_css + '</style>', 1)

    # Make the purpose and jurisdiction unambiguous without changing the overall layout.
    text = text.replace('<section id="candidates"><h1>Meet the candidates</h1>', '<section id="candidates"><div class="eyebrow">2026 Burlington, Ontario mayoral election</div><h1>Meet the mayoral candidates</h1><p class="section-intro">An independent, plain-language guide to who is running for Mayor of Burlington, what they have said, and what public records show.</p>', 1)

    # Add a persistent independence notice above the methodology section.
    if 'This is an independent civic project created by a Burlington resident.' not in text:
        text = text.replace(
            '<section id="method">',
            '<div class="site-independent-note"><strong>About this guide:</strong> This is an independent civic project created by a Burlington resident. It is not affiliated with the City of Burlington, Halton Region, any candidate or campaign. Information can change and errors are possible, so important voting details should be confirmed with official sources. <a href="help.html">Corrections and feedback</a> are welcome.</div>\n<section id="method">',
            1,
        )

    text = text.replace(
        '"New to elected politics in Canada."',
        '"Not currently a member of Burlington council."',
    )
    text = text.replace(
        '"contextTitle":"How your property-tax bill is set"',
        '"contextTitle":"What goes into your property-tax bill"',
    )
    text = text.replace(
        '"why":"Your bill has three parts: Burlington, Halton Region and education. Burlington’s share pays for local services, staff, roads, facilities and other city work. Costs rise when wages, construction or services cost more, or when the city adds spending. The mayor proposes a budget; council can change it and votes on the final version."',
        '"why":"Your property-tax bill combines charges from Burlington, Halton Region and education. Burlington’s share pays for local services, staff, roads and facilities. Costs change with wages, construction prices, service levels and new spending. The mayor proposes a budget; council can change it and votes on the final version."',
    )

    text = add_shared_assets(text)
    text = add_legal_footer(text)
    path.write_text(text, encoding="utf-8")


def polish_h2h(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        'h1{font-family:Georgia,Times,serif;',
        'h1{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-weight:850;',
        1,
    )
    if '@media(prefers-reduced-motion:reduce)' not in text:
        text = text.replace(
            '</style>',
            '@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\n</style>',
            1,
        )
    text = add_shared_assets(text)
    text = add_legal_footer(text)
    path.write_text(text, encoding="utf-8")


polish_index(Path("index.html"))
polish_h2h(Path("head-to-head.html"))
