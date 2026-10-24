# Prompts

This repo was built with [Claude Code](https://claude.com/claude-code). These
are the prompts that shaped it, verbatim and in order. The idea is the
valuable part; the code is one way to realise it.

## 1. The ask

> I have an Xteink X3 now. I want to read my Readwise articles on it.
>
> come up with automated ways that I can get readwise articles onto it

Claude answered with a menu of approaches – see [PLAN.md](PLAN.md#options).

## 2. The choice

> on crosspoint
>
> pick from my shortlist.
>
> hosted OPDS on Vercel

Three decisions: run the open-source
[CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) firmware
on the X3, use the Reader **Shortlist** as the queue, and serve it as a hosted
OPDS catalog on Vercel rather than pushing files from a computer.

## 3. More shelves

> can you make it show Shortlist, Archives, Later as 3 separate feeds in the
> same OPDS?

## 4. Going public

> check whether anyone has created something similar
>
> I want to move this to a clean new public github repo

> as part of my repo, include the prompt and the plan - that's more valuable
> than any code in the repo - the idea
