import {
  ExtensionContext,
  CancellationTokenSource,
  workspace,
  commands,
  window,
  ViewColumn,
  TextEditor,
  TextDocumentShowOptions,
} from "vscode";

import { AnsiDecorationProvider } from "./AnsiDecorationProvider";
import { EditorRedrawWatcher } from "./EditorRedrawWatcher";
import { PrettyAnsiContentProvider } from "./PrettyAnsiContentProvider";
import {
  executeRegisteredTextEditorDecorationProviders,
  registerTextEditorDecorationProvider,
} from "./TextEditorDecorationProvider";

export const extensionId = "iliazeus.vscode-ansi" as const;

export async function activate(context: ExtensionContext): Promise<void> {
  const editorRedrawWatcher = new EditorRedrawWatcher();
  context.subscriptions.push(editorRedrawWatcher);

  const prettyAnsiContentProvider = new PrettyAnsiContentProvider(editorRedrawWatcher);
  context.subscriptions.push(prettyAnsiContentProvider);

  context.subscriptions.push(
    workspace.registerTextDocumentContentProvider(PrettyAnsiContentProvider.scheme, prettyAnsiContentProvider)
  );

  const showPretty = async (options?: TextDocumentShowOptions) => {
    const actualUri = window.activeTextEditor?.document.uri;

    if (!actualUri) {
      return;
    }

    const providerUri = PrettyAnsiContentProvider.toProviderUri(actualUri);

    await window.showTextDocument(providerUri, options);
  };

  context.subscriptions.push(
    commands.registerCommand(`${extensionId}.showPretty`, () => showPretty({ viewColumn: ViewColumn.Active }))
  );
  context.subscriptions.push(
    commands.registerCommand(`${extensionId}.showPrettyToSide`, () => showPretty({ viewColumn: ViewColumn.Beside }))
  );

  const ansiDecorationProvider = new AnsiDecorationProvider();
  context.subscriptions.push(ansiDecorationProvider);

  context.subscriptions.push(registerTextEditorDecorationProvider(ansiDecorationProvider));

  context.subscriptions.push(
    editorRedrawWatcher.onEditorRedraw(async (editor) => {
      const tokenSource = new CancellationTokenSource();
      await executeRegisteredTextEditorDecorationProviders(editor, tokenSource.token);
      tokenSource.dispose();
    })
  );

  context.subscriptions.push(
    commands.registerTextEditorCommand(`${extensionId}.insertEscapeCharacter`, (editor, edit) => {
      edit.delete(editor.selection);
      edit.insert(editor.selection.end, "\x1b");
    })
  );
  window.onDidChangeActiveTextEditor((textEditor: TextEditor | undefined) => {
      if (textEditor?.document.languageId === 'ansi' || textEditor?.document.fileName.endsWith('.ansi') || textEditor?.document.fileName.endsWith('.log')) {
          if (textEditor.document.uri.scheme === 'undefined.pretty') {
              return;
          }
          const providerUri = PrettyAnsiContentProvider.toProviderUri(textEditor.document.uri);
          window.showTextDocument(providerUri,  { viewColumn: ViewColumn.Active });
        }
  });
}

export function deactivate(): void {
  // sic
}
