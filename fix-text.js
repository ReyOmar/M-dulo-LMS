const fs = require('fs');
const path = require('path');

const replacements = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã\xad': 'í',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã\x81': 'Á',
    'Ã ': 'Á', // careful with this
    'Ã‰': 'É',
    'Ã\x8d': 'Í',
    'Ã\x93': 'Ó',
    'Ã“': 'Ó',
    'Ã\x9a': 'Ú',
    'Ãš': 'Ú',
    'Ã‘': 'Ñ',
    'Â¿': '¿',
    'Â¡': '¡',
    'Ã¡': 'á',
    'âœ“': '✓',
    'âœ•': '✕',
    'â€”': '—',
    'â€¢': '•',
    'â†’': '→',
    'âš ï¸': '⚠️',
    'â•': '='
};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next' || file === 'dist' || file === '.git' || file === 'generated') continue;
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Direct string replacement for known weird symbols
            for (const [bad, good] of Object.entries(replacements)) {
                content = content.split(bad).join(good);
            }

            // Also fix the weird "Ã¡" etc that might have trailing whitespace issues
            content = content.replace(/Ã¡/g, 'á');
            content = content.replace(/Ã©/g, 'é');
            content = content.replace(/Ã­/g, 'í');
            content = content.replace(/Ã³/g, 'ó');
            content = content.replace(/Ãº/g, 'ú');
            content = content.replace(/Ã±/g, 'ñ');
            content = content.replace(/Ã\s/g, 'Á'); // "Ã " is often Á
            content = content.replace(/Ã‰/g, 'É');
            content = content.replace(/Ã /g, 'Í');
            content = content.replace(/Ã“/g, 'Ó');
            content = content.replace(/Ãš/g, 'Ú');
            content = content.replace(/Ã‘/g, 'Ñ');
            content = content.replace(/Â¿/g, '¿');
            content = content.replace(/Â¡/g, '¡');
            content = content.replace(/âœ“/g, '✓');
            content = content.replace(/âœ•/g, '✕');
            content = content.replace(/â€”/g, '—');
            content = content.replace(/â€¢/g, '•');
            content = content.replace(/â†’/g, '→');
            content = content.replace(/âš ï¸/g, '⚠️');
            content = content.replace(/â•/g, '=');
            // Check for specific "Área" case: "Ã rea"
            content = content.replace(/Ã rea/g, 'Área');
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed: ${fullPath}`);
            }
        }
    }
}

console.log('Starting text correction...');
processDirectory(path.join(__dirname, 'apps'));
console.log('Done.');
