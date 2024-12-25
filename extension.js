const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let projectStats = {};

function activate(context) {
    console.log('Extension "track-completeness" is now active.');

    // Command: Mark All Files and Functions as Unfinished
    context.subscriptions.push(
        vscode.commands.registerCommand('track-completeness.markAllUnfinished', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open.');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const cppFiles = findCppFiles(rootPath);

            cppFiles.forEach(file => {
                if (!projectStats[file]) {
                    projectStats[file] = { total: 0, completed: 0, functions: [] };
                }

                const fileContent = fs.readFileSync(file, 'utf-8');
                const functionNames = extractFunctionNames(fileContent);

                functionNames.forEach(funcName => {
                    const existingFunction = projectStats[file].functions.find(f => f.name === funcName);
                    if (existingFunction) {
                        existingFunction.completed = false; // Mark as unfinished
                    } else {
                        projectStats[file].functions.push({ name: funcName, completed: false });
                        projectStats[file].total += 1;
                    }
                });

                // Update completed count
                projectStats[file].completed = projectStats[file].functions.filter(f => f.completed).length;
            });

            vscode.window.showInformationMessage(
                `Marked all functions in ${cppFiles.length} files as unfinished.`
            );
        })
    );

    // Command: Mark All Functions in Current File as Completed
    context.subscriptions.push(
        vscode.commands.registerCommand('track-completeness.markAllCompleted', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open.');
                return;
            }

            const fileName = editor.document.fileName;
            const fileContent = editor.document.getText();

            if (!projectStats[fileName]) {
                projectStats[fileName] = { total: 0, completed: 0, functions: [] };
            }

            const fileStats = projectStats[fileName];
            const functionNames = extractFunctionNames(fileContent);

            functionNames.forEach(funcName => {
                const existingFunction = fileStats.functions.find(f => f.name === funcName);
                if (existingFunction) {
                    existingFunction.completed = true; // Mark as completed
                } else {
                    fileStats.functions.push({ name: funcName, completed: true });
                    fileStats.total += 1;
                }
            });

            // Update completed count
            fileStats.completed = fileStats.functions.filter(f => f.completed).length;

            vscode.window.showInformationMessage(
                `Marked all functions in ${path.basename(fileName)} as completed.`
            );
        })
    );

    // Command: Show Project Completion Stats
    context.subscriptions.push(
        vscode.commands.registerCommand('track-completeness.projectStats', () => {
            const totalFiles = Object.keys(projectStats).length;
            const totalFunctions = Object.values(projectStats).reduce((sum, file) => sum + file.total, 0);
            const completedFunctions = Object.values(projectStats).reduce((sum, file) => sum + file.completed, 0);
            const percentComplete = totalFunctions > 0 ? (completedFunctions / totalFunctions * 100).toFixed(2) : 0;

            vscode.window.showInformationMessage(
                `Project Completion: ${percentComplete}% (${completedFunctions}/${totalFunctions} functions completed across ${totalFiles} files).`
            );
        })
    );

    // Command: Show Functions in Current File
    context.subscriptions.push(
        vscode.commands.registerCommand('track-completeness.fileFunctions', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open.');
                return;
            }

            const fileName = editor.document.fileName;
            const fileStats = projectStats[fileName];

            if (!fileStats) {
                vscode.window.showErrorMessage('No tracked functions in this file.');
                return;
            }

            const { completedFunctions, uncompletedFunctions } = fileStats.functions.reduce(
                (acc, func) => {
                    if (func.completed) acc.completedFunctions.push(func.name);
                    else acc.uncompletedFunctions.push(func.name);
                    return acc;
                },
                { completedFunctions: [], uncompletedFunctions: [] }
            );

            vscode.window.showInformationMessage(
                `Completed Functions: ${completedFunctions.join(', ')}\nUncompleted Functions: ${uncompletedFunctions.join(', ')}`
            );
        })
    );

    // Command: Toggle Function Completion
    context.subscriptions.push(
        vscode.commands.registerCommand('track-completeness.toggleFunction', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file is currently open.');
                return;
            }

            const fileName = editor.document.fileName;
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!projectStats[fileName]) {
                projectStats[fileName] = { total: 0, completed: 0, functions: [] };
            }

            const fileStats = projectStats[fileName];
            const existingFunction = fileStats.functions.find(func => func.name === selectedText);

            if (existingFunction) {
                existingFunction.completed = !existingFunction.completed;
                fileStats.completed += existingFunction.completed ? 1 : -1;
            } else {
                fileStats.functions.push({ name: selectedText, completed: false });
                fileStats.total += 1;
            }

            vscode.window.showInformationMessage(
                `Function "${selectedText}" marked as ${existingFunction?.completed ? 'completed' : 'not completed'}.`
            );
        })
    );
}

function findCppFiles(dir) {
    const files = fs.readdirSync(dir);
    let cppFiles = [];

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            cppFiles = cppFiles.concat(findCppFiles(fullPath));
        } else if (file.endsWith('.cpp')) {
            cppFiles.push(fullPath);
        }
    });

    return cppFiles;
}

function extractFunctionNames(content) {
    const functionRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*?\)\s*{/g;
    const matches = content.match(functionRegex) || [];
    return matches.map(match => match.split('(')[0].trim());
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
