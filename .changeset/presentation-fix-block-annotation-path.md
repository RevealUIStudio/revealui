---
'@revealui/presentation': patch
---

Fix `RenderBlocks` emitting `data-rvui-field` paths one segment short of the real draft structure (e.g. `blocks.0.title` instead of `blocks.0.data.title`). Every block component reads its fields from `block.data.*`, so a path stopping at the block index landed an edit-session patch as a sibling of `data` instead of inside it — silently corrupting the block's data on write, both in the session draft and (on publish) the live page. Attributes only appear in edit mode (`editable` + `docId`), so this does not affect any non-edit-mode rendering or visual output.
