import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
    'AGENT_GUIDE.md',
    'AGENTS.md',
    'CLAUDE.md',
    '.agentrules',
    '.agents/workflows/test_pwa_dashboard.md'
];
const skills = [
    'pwa-dashboard-verification',
    'garmin-integration',
    'hypertrophy-coaching',
    'luxury-ui-review'
];

function read(relativePath) {
    const fullPath = path.join(root, relativePath);
    if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
    return fs.readFileSync(fullPath, 'utf8');
}

for (const file of requiredFiles) read(file);

for (const file of ['AGENTS.md', 'CLAUDE.md', '.agentrules']) {
    if (!read(file).includes('AGENT_GUIDE.md')) throw new Error(`${file} must point to AGENT_GUIDE.md`);
}

if (!read('AGENT_GUIDE.md').includes('Canonical project guidance')) {
    throw new Error('AGENT_GUIDE.md must identify itself as the canonical guide');
}

if (!read('.agents/workflows/test_pwa_dashboard.md').includes('http://localhost:3000')) {
    throw new Error('PWA workflow must use the documented local frontend port');
}

for (const skill of skills) {
    const skillPath = `.agents/skills/${skill}/SKILL.md`;
    const content = read(skillPath);
    if (!new RegExp(`^---\\r?\\nname: ${skill}\\r?\\ndescription: .+\\r?\\n---`, 's').test(content)) {
        throw new Error(`${skillPath} has invalid frontmatter`);
    }
    if (content.includes('[TODO:')) throw new Error(`${skillPath} still contains template content`);
    read(`.agents/skills/${skill}/agents/openai.yaml`);
}

console.log('Agent setup: OK');
