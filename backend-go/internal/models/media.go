package models

type FileInfo struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	URL      string `json:"url"`
	PublicID string `json:"publicId,omitempty"`
}

type UploadResult struct {
	Success bool       `json:"success"`
	Files   []FileInfo `json:"files"`
}