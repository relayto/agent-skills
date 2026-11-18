# RELAYTO agent skills

Skills, a plugin and agent rules that teach AI agents to work with
[RELAYTO](https://relayto.com), the platform that turns PDFs, decks, reports and web pages
into interactive content, organizes it into hubs, publishes it on `*.relayto.com` or your
own domain and measures it page by page.

## Install

Any agent that reads Agent Skills (Claude Code, Codex, Cursor, Copilot and others):

```sh
npx skills add relayto/agent-skills
```

Claude Code, as a plugin with the RELAYTO MCP server included:

```
/plugin marketplace add relayto/agent-skills
/plugin install relayto@relayto
```

Other Agent Plugin clients load this repository as is (`plugin.json` + `mcp.json`).

## Skills

| Skill | What it teaches an agent |
| --- | --- |
| [relayto-web-content](skills/relayto-web-content/SKILL.md) | Build a hand-made HTML page and publish it to RELAYTO: assets in Workspace Files, the viewer's rules, links that open a document on a given page, a thumbnail, browser checks |
| [relayto-web-components](skills/relayto-web-components/SKILL.md) | Make that page editable in RELAYTO's web-content editor: the component schema, field markers, a page script that works with the editor, and a validator |
| [relayto-read-published-site](skills/relayto-read-published-site/SKILL.md) | Read and cite any site published on RELAYTO through its MCP server, API, llms.txt and Markdown, no account needed |

The web-page skills work through the RELAYTO MCP server, `https://mcp.relayto.com/mcp`
(sign in with your RELAYTO account; see [AGENTS.md](AGENTS.md#connect-the-mcp-server)),
and need admin rights in the workspace, since Workspace Files uploads are admin-only.

## What else is here

| Path | What |
| --- | --- |
| `skills/` | Agent Skills |
| `plugin.json`, `mcp.json` | The Agent Plugin (with the ChatGPT directory listing) |
| `.claude-plugin/`, `.mcp.json` | The same plugin and its marketplace for Claude Code |
| `AGENTS.md`, `.claude/`, `.cursor/rules/`, `.windsurf/rules/`, `.github/copilot-instructions.md` | Agent rules for coding tools |
| `scripts/` | `npm run check`: the manifests, every skill's frontmatter, and `npx skills` finding every skill |

The `relayto-mcp` bridge, the `relayto` SDK and CLI, and the MCP Registry entries live in
[relayto/relayto-mcp](https://github.com/relayto/relayto-mcp). Developer docs:
[RELAYTO API, MCP server & SDK](https://relayto.com/hub/api).

## Contributing

See [AGENTS.md](AGENTS.md#working-on-this-repository). Bump the plugin version with every
change, and keep customer names out of examples.

Report security issues to support@relayto.com.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE).
