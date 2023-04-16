import * as vscode from 'vscode';
import { GltfWindow } from './gltfWindow';

function configurationChanged(): void {
    const config = vscode.workspace.getConfiguration('glTF');
    const showToolbar3D = config.get('showToolbar3D');

    vscode.commands.executeCommand('setContext', 'gltfShowToolbar3D', showToolbar3D);
}

// this method is called when your extension is activated
// your extension is activated the very first time a command is executed
export function activate(context: vscode.ExtensionContext): void {

    // Set configuration options
    vscode.workspace.onDidChangeConfiguration(configurationChanged);
    configurationChanged();
    // Create the window object that manages the various views.
    const gltfWindow = new GltfWindow(context);

    context.subscriptions.push(vscode.commands.registerCommand('gltf.previewModel', () => {
        const textEditor = vscode.window.activeTextEditor;
        gltfWindow.preview.openPanel(textEditor);
    }));

}
