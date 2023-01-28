import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ContextBase } from './contextBase';
import { parseJsonMap, JsonMap } from './utilities';
import { GLTF2 } from './GLTF2';

export interface GltfPreviewPanel extends vscode.WebviewPanel {
    readonly textEditor: vscode.TextEditor;
    readonly ready: boolean;
}

interface GltfPreviewPanelInfo extends GltfPreviewPanel {
    textEditor: vscode.TextEditor;
    ready: boolean;

    _jsonMap: { data: GLTF2.GLTF, pointers: any };
    _defaultBabylonReflection: string;
    _defaultFilamentReflection: string;
    _defaultThreeReflection: string;

    _watchers: Array<fs.FSWatcher>;
}

export class GltfPreview extends ContextBase {
    private readonly _mainHtml: string;
    private readonly _threeHtml: string;

    private _panels: { [fileName: string]: GltfPreviewPanelInfo } = {};

    private _activePanel: GltfPreviewPanel;
    private _onDidChangeActivePanel: vscode.EventEmitter<GltfPreviewPanel | undefined> = new vscode.EventEmitter<GltfPreviewPanel | undefined>();
    private _onDidChangePanelReady: vscode.EventEmitter<GltfPreviewPanel> = new vscode.EventEmitter<GltfPreviewPanel>();

    constructor(context: vscode.ExtensionContext) {
        super(context);

        this._mainHtml = fs.readFileSync(this._context.asAbsolutePath('pages/previewModel.html'), 'utf-8');
        this._threeHtml = encodeURI(fs.readFileSync(this._context.asAbsolutePath('pages/threeView.html'), 'utf-8'));
    }

    private asExtensionUriString(panel: GltfPreviewPanel, s: string): string {
        return panel.webview.asWebviewUri(vscode.Uri.file(path.join(this.extensionRootPath, s))).toString();
    }

    private asWebviewUriString(panel: GltfPreviewPanel, s: string): string {
        return panel.webview.asWebviewUri(vscode.Uri.file(s)).toString();
    }

    // Instructions to open DevTools on the glTF preview window:
    //
    // 1. Open the glTF preview window.
    //
    // 2. Press F1 to open the command bar at the top of VSCode.
    //
    // 3. Type in and run the following command:
    //    Developer: Open Webview Developer Tools
    //
    // 4. In the top of the Console tab of DevTools, click the pull-down
    //    and change `top` to `active-frame (index.html)`.

    public openPanel(gltfEditor: vscode.TextEditor): void {
        const gltfFilePath = gltfEditor.document.fileName;

        let panel = this._panels[gltfFilePath];
        if (!panel) {
            let localResourceRoots = [
                vscode.Uri.file(this._context.extensionPath),
                vscode.Uri.file(path.dirname(gltfFilePath)),
                vscode.Uri.file(path.join(this._context.extensionPath, 'resources'))
            ];

            const defaultBabylonReflection = this.getConfigResourceUrl('glTF.Babylon', 'environment', localResourceRoots);
            const defaultFilamentReflection = this.getConfigResourceUrl('glTF.Filament', 'environment', localResourceRoots);
            const defaultThreeReflection = this.getConfigResourceUrl('glTF.Three', 'environment', localResourceRoots);

            panel = vscode.window.createWebviewPanel('gltf.preview', 'glTF Preview', vscode.ViewColumn.Two, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: localResourceRoots,
            }) as GltfPreviewPanelInfo;

            panel._defaultBabylonReflection = defaultBabylonReflection;
            panel._defaultFilamentReflection = defaultFilamentReflection;
            panel._defaultThreeReflection = defaultThreeReflection;

            panel._watchers = [];

            panel.textEditor = gltfEditor;

            panel.onDidDispose(() => {
                this.unwatchFiles(this._panels[gltfFilePath]);
                delete this._panels[gltfFilePath];
                this.updateActivePanel();
            });

            panel.onDidChangeViewState(() => {
                this.updateActivePanel();
            });

            this._panels[gltfFilePath] = panel;
        }

        const gltfContent = gltfEditor.document.getText();
        // TODO: USE TEXT EDITOR CONTENT
        // const data = new Uint8Array(Buffer.from('Hello Node.js'));
        // fs.writeFileSync('model.txt', data);
        this.updatePanel(panel, gltfFilePath, gltfContent);
        panel.reveal(vscode.ViewColumn.Two);

        this.setActivePanel(panel);
    }

    public get activePanel(): GltfPreviewPanel | undefined {
        return this._activePanel;
    }

    public readonly onDidChangeActivePanel = this._onDidChangeActivePanel.event;

    public getPanel(fileName: string): GltfPreviewPanel | undefined {
        return this._panels[fileName];
    }

    public readonly onDidChangeReadyState = this._onDidChangePanelReady.event;

    private setActivePanel(activePanel: GltfPreviewPanel | undefined): void {
        if (this._activePanel !== activePanel) {
            this._activePanel = activePanel;
            this._onDidChangeActivePanel.fire(activePanel);

            if (activePanel) {
                activePanel.webview.postMessage({ command: 'updateDebugMode' });
            }
            else {
                vscode.commands.executeCommand('setContext', 'gltfDebugActive', false);
            }
        }
    }

    private updateActivePanel(): void {
        const activePanel = Object.values(this._panels).find(panel => panel.active);
        this.setActivePanel(activePanel);
    }

    private updatePanel(panel: GltfPreviewPanelInfo, gltfFilePath: string, gltfContent: string): void {
        let map: JsonMap<GLTF2.GLTF>;
        try {
            map = parseJsonMap(gltfContent);
        } catch (ex) {
            vscode.window.showErrorMessage('' + ex);
            map = { data: { asset: { version: '2.0' } }, pointers: {} };
        }
        panel._jsonMap = map;

        const gltfRootPath = this.asWebviewUriString(panel, path.dirname(gltfFilePath)) + '/';
        const gltfFileName = path.basename(gltfFilePath);

        const gltf = map.data;
        let gltfMajorVersion = 1;
        if (gltf && gltf.asset && gltf.asset.version && gltf.asset.version[0] === '2') {
            gltfMajorVersion = 2;
        }

        panel.title = `IFC Preview - ${gltfFileName}`;
        const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'resources', 'main.js'));
        const css = panel.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'resources', 'style.css'));
        panel.webview.html = this.getWebviewContent(' Test ', css, script);
        this.watchFiles(panel); // watches changes after save in gltf file
    }

    private getWebviewContent(x: string, stylePath: vscode.Uri, scriptPath: vscode.Uri) {
        return `<!DOCTYPE html>
                    <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <link rel="stylesheet" href="${stylePath}" />
                            <title>IFC VIEWER</title>
                        </head>
                        <body>
                            <div class="canvas">
                                <canvas id="three-canvas"></canvas>
                            </div>
                            <script src="${scriptPath}" type="module"></script>
                        </body>
                    </html>`;
    }

    private watchFiles(panel: GltfPreviewPanelInfo): void {
        this.unwatchFiles(panel);

        const document = panel.textEditor.document;
        const documentFilePath = document.fileName;
        panel._watchers.push(fs.watch(documentFilePath, () => {
            this.updatePanel(panel, documentFilePath, document.getText());
        }));

        const documentDirectoryPath = path.dirname(documentFilePath);

        const watch = (object: Object) => {
            for (const key in object) {
                if (object.hasOwnProperty(key)) {
                    const value = object[key];
                    if (key === "uri" && typeof value === "string" && !value.startsWith("data:")) {
                        const filePath = path.join(documentDirectoryPath, decodeURI(value));
                        if (fs.existsSync(filePath)) {
                            panel._watchers.push(fs.watch(filePath, () => {
                                panel.webview.postMessage({ command: 'refresh' });
                            }));
                        }
                    }
                    else if (typeof value === "object") {
                        watch(value);
                    }
                }
            }
        };

        watch(panel._jsonMap.data);
    }

    private unwatchFiles(panel: GltfPreviewPanelInfo) {
        for (const watcher of panel._watchers) {
            watcher.close();
        }

        panel._watchers.length = 0;
    }
}
