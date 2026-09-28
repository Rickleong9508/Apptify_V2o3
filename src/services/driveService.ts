// Google Drive Service (Client-Side)

const FILENAME = 'MyWealth_Backup.json';

export interface DriveConfig {
    clientId: string;
    accessToken: string | null;
    tokenExpiry: number | null;
    autoSync: boolean;
}

// Check if token is valid (with 60s buffer)
export const isTokenValid = (expiry: number | null) => {
    if (!expiry) return false;
    return Date.now() < (expiry - 60000);
};

// Helper to handle fetch errors
const handleResponse = async (res: Response, context: string) => {
    if (!res.ok) {
        let errorMsg = `${context} failed (${res.status})`;
        try {
            const errorBody = await res.json();
            errorMsg += `: ${errorBody.error?.message || JSON.stringify(errorBody)}`;
        } catch (e) {
            const text = await res.text();
            errorMsg += `: ${text}`;
        }
        
        if (res.status === 403) {
            throw new Error("Access Denied (403). Please ensure 'Google Drive API' is ENABLED in your Google Cloud Console.");
        }
        if (res.status === 401) {
            throw new Error("Unauthorized (401). Token expired or invalid. Please reconnect.");
        }
        throw new Error(errorMsg);
    }
    return res.json();
};

// 1. Search for existing backup file
const findFile = async (token: string) => {
    // Request ID and Modified Time
    const q = `name = '${FILENAME}' and trashed = false`;
    const fields = "files(id, name, modifiedTime)";
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await handleResponse(response, "Searching for backup");
    
    if (data.files && data.files.length > 0) {
        return data.files[0]; // Return first match
    }
    return null;
};

// Public wrapper to check metadata
export const getBackupMetadata = async (token: string) => {
    return await findFile(token);
};

// 2. Upload File (Create or Update)
export const saveToDrive = async (token: string, data: any) => {
    // Check if file exists first
    let existingFile;
    try {
        existingFile = await findFile(token);
    } catch (e) {
        console.warn("Could not check for existing file, attempting create...", e);
    }
    
    const metadata = {
        name: FILENAME,
        mimeType: 'application/json',
    };
    
    const fileContent = JSON.stringify(data, null, 2);
    
    // Multipart Request Construction
    const boundary = 'mw_boundary_' + Date.now().toString();
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const body = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;

    const contentType = `multipart/related; boundary=${boundary}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType
    };

    if (existingFile) {
        // UPDATE existing file
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`, {
            method: 'PATCH',
            headers,
            body
        });
        await handleResponse(res, "Updating file");
        return { status: 'updated', fileId: existingFile.id };
    } else {
        // CREATE new file
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
            method: 'POST',
            headers,
            body
        });
        const json = await handleResponse(res, "Creating file");
        return { status: 'created', fileId: json.id };
    }
};

// 3. Load File
export const loadFromDrive = async (token: string) => {
    const existingFile = await findFile(token);
    if (!existingFile) throw new Error("No backup file found in your Google Drive.");

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        await handleResponse(response, "Downloading file");
    }
    
    return await response.json();
};
