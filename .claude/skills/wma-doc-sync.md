# /wma-doc-sync

Update `CLAUDE.md` to reflect the current state of the project after completing a build day.

## Steps

1. Read the current `CLAUDE.md`
2. Check the actual file system state of `ui/src/components/` and `server/`
3. Update the "Current Progress" section:
   - Mark completed days as ✅ COMPLETE
   - Mark the next day as 🔜 NEXT
   - Add any key implementation notes discovered during the build
4. Update the folder structure if new files were added
5. Save — do not change any other sections unless they are factually wrong

## Do not:
- Change the design system section
- Change architecture decisions
- Rewrite prose — just update status markers and add factual notes
