
// Service to handle GitHub API interactions

const BASE_URL = 'https://api.github.com';

interface GithubAuth {
    token: string;
}

export interface GithubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: 'file' | 'dir';
}

export interface GithubCommit {
    sha: string;
    commit: {
        author: { name: string; email: string; date: string };
        message: string;
    };
    html_url: string;
}

export interface GithubOrg {
    login: string;
    id: number;
    url: string;
    avatar_url: string;
    description: string;
}

export interface GithubMember {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
}

export const githubApi = {
    // Helper to get headers
    getHeaders: (token: string) => ({
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    }),

    // List contents of a path (files and dirs)
    getContents: async (token: string, owner: string, repo: string, path: string = '', branch?: string): Promise<GithubFile[]> => {
        let url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}`;
        if (branch) url += `?ref=${branch}`;

        const res = await fetch(url, { headers: githubApi.getHeaders(token) });
        if (!res.ok) throw new Error('Failed to fetch repository contents');
        
        const data = await res.json();
        return Array.isArray(data) ? data : [data]; // If it's a single file, api returns object, not array
    },

    // Get raw file content
    getFileContent: async (token: string, owner: string, repo: string, path: string, branch?: string): Promise<{ content: string, sha: string }> => {
        let url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}`;
        if (branch) url += `?ref=${branch}`;

        const res = await fetch(url, { headers: githubApi.getHeaders(token) });
        if (!res.ok) throw new Error('Failed to fetch file content');
        
        const data = await res.json();
        // GitHub API returns content in base64
        const content = new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
        return { content, sha: data.sha };
    },

    // Get README content specifically
    getReadme: async (token: string, owner: string, repo: string, branch?: string): Promise<string> => {
        let url = `${BASE_URL}/repos/${owner}/${repo}/readme`;
        if (branch) url += `?ref=${branch}`;

        const res = await fetch(url, { headers: githubApi.getHeaders(token) });
        if (!res.ok) return '';
        
        const data = await res.json();
        // GitHub API returns content in base64
        return new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
    },

    // Get branches
    getBranches: async (token: string, owner: string, repo: string): Promise<string[]> => {
        const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/branches`, { headers: githubApi.getHeaders(token) });
        if (!res.ok) return ['main'];
        const data = await res.json();
        return data.map((b: any) => b.name);
    },

    // Get commits
    getCommits: async (token: string, owner: string, repo: string, branch?: string): Promise<GithubCommit[]> => {
        let url = `${BASE_URL}/repos/${owner}/${repo}/commits?per_page=20`;
        if (branch) url += `&sha=${branch}`;
        
        const res = await fetch(url, { headers: githubApi.getHeaders(token) });
        if (!res.ok) return [];
        return await res.json();
    },

    // Get a specific Reference SHA (useful for branching)
    getRef: async (token: string, owner: string, repo: string, ref: string): Promise<string> => {
        // ref e.g., 'heads/main'
        const url = `${BASE_URL}/repos/${owner}/${repo}/git/ref/${ref}`;
        const res = await fetch(url, { headers: githubApi.getHeaders(token) });
        if (!res.ok) throw new Error('Failed to fetch ref');
        const data = await res.json();
        return data.object.sha;
    },

    // Create a Branch
    createBranch: async (token: string, owner: string, repo: string, newBranchName: string, baseSha: string) => {
        const url = `${BASE_URL}/repos/${owner}/${repo}/git/refs`;
        const body = {
            ref: `refs/heads/${newBranchName}`,
            sha: baseSha
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: githubApi.getHeaders(token),
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to create branch');
        }
        return await res.json();
    },

    // Create/Update file (Commit)
    updateFile: async (
        token: string, 
        owner: string, 
        repo: string, 
        path: string, 
        content: string, 
        message: string, 
        sha?: string, // Required for update, omitted for create
        branch: string = 'main'
    ) => {
        const url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}`;
        
        // Encode content to Base64 (handle unicode correctly)
        const encodedContent = btoa(unescape(encodeURIComponent(content)));

        const body: any = {
            message,
            content: encodedContent,
            branch
        };

        if (sha) {
            body.sha = sha;
        }

        const res = await fetch(url, {
            method: 'PUT',
            headers: githubApi.getHeaders(token),
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to commit changes');
        }

        return await res.json();
    },

    // Get User Organizations
    getUserOrgs: async (token: string): Promise<GithubOrg[]> => {
        const res = await fetch(`${BASE_URL}/user/orgs`, { headers: githubApi.getHeaders(token) });
        if (!res.ok) throw new Error('Failed to fetch organizations');
        return await res.json();
    },

    // Get Organization Members
    getOrgMembers: async (token: string, orgName: string): Promise<GithubMember[]> => {
        // per_page=100 is max. For production we should paginate.
        const res = await fetch(`${BASE_URL}/orgs/${orgName}/members?per_page=100`, { headers: githubApi.getHeaders(token) });
        if (!res.ok) throw new Error('Failed to fetch org members. Check if you are an owner/member.');
        return await res.json();
    }
};