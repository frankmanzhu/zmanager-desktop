# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues at
`frankmanzhu/zmanager-desktop`. Use the authenticated `gh` CLI for issue
operations.

## Repository

- URL: `https://github.com/frankmanzhu/zmanager-desktop`
- Run commands from this clone so `gh` infers the repository.
- When running elsewhere, pass `--repo frankmanzhu/zmanager-desktop`.
- Before a write operation, verify authentication with `gh auth status` when
  the current session has not already established it.

## Common operations

- Create an issue: `gh issue create --title "..." --body "..."`
- Create an issue with a multiline body in PowerShell: write the proposed body
  to a temporary Markdown file, then run
  `gh issue create --title "..." --body-file <path>`.
- Read an issue with its discussion: `gh issue view <number> --comments`
- List open issues:
  `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Apply a label: `gh issue edit <number> --add-label "..."`
- Remove a label: `gh issue edit <number> --remove-label "..."`
- Close with an explanation:
  `gh issue close <number> --comment "..."`

Use `--json` and `--jq` when a skill needs structured issue data. Never infer
issue state solely from a title; inspect the body, labels, and relevant comments.

## Skill conventions

When a skill says **publish to the issue tracker**, create a GitHub issue in
this repository. When it says **fetch the relevant ticket**, run
`gh issue view <number> --comments` and include its labels in the inspection.

Do not create, edit, label, comment on, or close an issue unless the user's
request authorizes that external change.
