# PR Review Workflow Guidelines

## レビューコメントへの対応

1. **個別返信を必ず行う**: レビューコメントには必ず個別に返信する
   - インラインコメント（ファイル行に対するコメント）: `gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies --method POST -f body="..."` を使用
   - レビューサマリのnitpick: PRコメントとして返信し、該当レビューのURLを明記

2. **Nitpickへの対応**: 
   - nitpickも必ず対応する（軽微な改善提案でも対応）
   - 対応後はコミットし、返信コメントで対応完了を報告
   - 変更内容と該当コミットハッシュを明記

3. **GitHub API エンドポイント**:
   - レビューコメントへの返信: `POST /repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies`
   - PRコメント追加: `mcp__github__add_issue_comment` を使用

## 対応フロー

1. `mcp__github__pull_request_read` で `get_review_comments` を取得
2. 各コメントの内容を確認
3. 必要なコード修正を実施
4. コミット＆プッシュ
5. 各コメントに個別返信（修正済み or 理由説明）
