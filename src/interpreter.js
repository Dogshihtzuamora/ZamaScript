// using canvas

function createCommandRegistry() {
    const commands = new Map();
    return {
        register(keyword, handler) {
            commands.set(keyword, handler);
        },
        get(keyword) {
            return commands.get(keyword);
        },
        has(keyword) {
            return commands.has(keyword);
        }
    };
}

function interpretar(canvasId, code) {
    const variables = {};
    const registry = createCommandRegistry();
    const canvas = document.getElementById(canvasId);
    const ctx = canvas ? canvas.getContext('2d') : null;
    let displayCount = 0;

    if (!ctx) {
        throw new Error('Canvas não encontrado ou contexto inválido.');
    }

    function setCanvasDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    setCanvasDPI();

    registry.register('set', (line, variables, fullLines, index) => {
        const setMatch = line.match(/^set\s+(\w+)\s*=\s*(.+)$/);
        if (!setMatch) {
            throw new Error(`Comando 'set' inválido: ${line}`);
        }

        const varName = setMatch[1];
        let valueStr = setMatch[2].trim();
        let value;
        let linesConsumed = 0;

        if (valueStr.startsWith('{')) {
            let objectStr = valueStr;
            if (!valueStr.endsWith('}')) {
                let braceCount = 1;
                let i = index + 1;
                while (i < fullLines.length && braceCount > 0) {
                    const nextLine = fullLines[i].trim();
                    objectStr += ' ' + nextLine;
                    braceCount += (nextLine.match(/{/g) || []).length;
                    braceCount -= (nextLine.match(/}/g) || []).length;
                    i++;
                    linesConsumed++;
                }
                if (braceCount !== 0) {
                    throw new Error(`Objeto malformado em: ${line}`);
                }
            }

            value = {};
            const content = objectStr.slice(objectStr.indexOf('{') + 1, objectStr.lastIndexOf('}')).trim();
            if (content) {
                const pairs = content.split(',').map(pair => pair.trim()).filter(pair => pair);
                for (const pair of pairs) {
                    const [key, val] = pair.split(':').map(s => s.trim());
                    if (!key || !val) {
                        throw new Error(`Par chave-valor inválido em: ${pair}`);
                    }
                    if (variables[val] !== undefined) {
                        value[key] = variables[val];
                    } else if (val.match(/^-?\d+(\.\d+)?$/)) {
                        value[key] = Number(val);
                    } else if (val === 'true' || val === 'false') {
                        value[key] = val === 'true';
                    } else if ((val.startsWith("'") && val.endsWith("'")) ||
                              (val.startsWith('"') && val.endsWith('"'))) {
                        value[key] = val.slice(1, -1);
                    } else {
                        value[key] = val;
                    }
                }
            }
        } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
            value = valueStr.slice(1, -1);
        } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
            value = valueStr.slice(1, -1);
        } else if (valueStr === 'true' || valueStr === 'false') {
            value = valueStr === 'true';
        } else if (!isNaN(valueStr)) {
            value = Number(valueStr);
        } else if (variables[valueStr] !== undefined) {
            value = variables[valueStr];
        } else {
            throw new Error(`Valor inválido no comando: ${line}`);
        }

        variables[varName] = value;
        return linesConsumed;
    });

    registry.register('display', (line, variables) => {
        const match = line.match(/^display\((.*)\)$/);
        if (!match) throw new Error(`Sintaxe inválida em 'display': ${line}`);

        const displayContent = match[1].trim();
        let result;

        try {
            const evaluated = eval(displayContent.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
                if (variables.hasOwnProperty(match)) {
                    return `variables["${match}"]`;
                }
                return match;
            }));
            result = evaluated;
        } catch (error) {
            throw new Error(`Erro ao avaliar expressão: ${displayContent}`);
        }

        ctx.font = '16px Arial';
        ctx.fillStyle = '#000000';
        ctx.textRendering = 'optimizeLegibility';
        displayCount++;
        const yPos = 20 + (displayCount - 1) * 20;
        ctx.fillText(String(result), 10, yPos);
        return 0;
    });

    const lines = code.split('\n').map(line => line.trim()).filter(line => line);
    for (let i = 0; i < lines.length; i++) {
        try {
            const trimmedLine = lines[i];
            let commandName = null;
            if (trimmedLine.includes('(')) {
                commandName = trimmedLine.substring(0, trimmedLine.indexOf('('));
            } else if (trimmedLine.startsWith('set ')) {
                commandName = 'set';
            }

            if (!commandName || !registry.has(commandName)) {
                throw new Error(`Comando desconhecido: ${trimmedLine}`);
            }

            const linesConsumed = registry.get(commandName)(trimmedLine, variables, lines, i);
            i += linesConsumed;
        } catch (error) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#FF0000';
            ctx.textRendering = 'optimizeLegibility';
            displayCount++;
            const yPos = 20 + (displayCount - 1) * 20;
            ctx.fillText(`Erro: ${error.message}`, 10, yPos);
        }
    }
}
