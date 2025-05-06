import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    FlatList,
    Modal,
    Text,
    TouchableOpacity,
    View
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId:
            "963423070151-sorb3gfb3hnnsbshbd4s5sdogvf50ddm.apps.googleusercontent.com",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    useEffect(() => {
        if (response?.type === "success") {
            const { authentication } = response;
            const token = authentication?.accessToken;
            setAccessToken(token);
            fetchGoogleDriveFiles(token, null, true); // Load initial page only
        }
    }, [response]);

    const fetchGoogleDriveFiles = async (
        token: string | undefined,
        pageToken: string | null = null,
        openModal: boolean = false
    ) => {
        if (!token) return;
        setIsFetchingMore(true);
        try {
            const res = await fetch(
                `https://www.googleapis.com/drive/v3/files?pageSize=20&fields=nextPageToken,files(id,name,mimeType,size)&pageToken=${pageToken ?? ""}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const json = await res.json();
            setDriveFiles(prev => [...prev, ...(json.files || [])]);
            setNextPageToken(json.nextPageToken || null);

            if (openModal) {
                setModalVisible(true);
            }
        } catch (error) {
            console.error("Drive fetch error:", error);
        } finally {
            setIsFetchingMore(false);
        }
    };

    const handleLoadMore = () => {
        if (accessToken && nextPageToken && !isFetchingMore) {
            fetchGoogleDriveFiles(accessToken, nextPageToken);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={{
                padding: 10,
                borderBottomColor: '#ddd',
                borderBottomWidth: 1,
            }}
            onPress={() => handleFileSelect(item)}
        >
            <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
            <Text>Type: {item.mimeType}</Text>
            <Text>Size: {item.size ? `${(item.size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'}</Text>
        </TouchableOpacity>
    );


    const handleFileSelect = async (file: { id: any; name: any; mimeType: any }) => {
        try {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                console.log(`📁 Folder selected: ${file.name}`);
                await downloadFolderContents(file.id, file.name);
                return;
            }

            const isGoogleDoc = file.mimeType.startsWith("application/vnd.google-apps");

            const downloadUrl = isGoogleDoc
                ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`
                : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

            const res = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();

            console.log(`✅ File downloaded in browser: ${file.name}`);
        } catch (err) {
            console.error("Error downloading file:", err);
        }
    };

    const downloadFolderContents = async (folderId: string, folderName: string) => {
        try {
            const res = await fetch(
                `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size)`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );
    
            const json = await res.json();
            const files = json.files;
    
            if (!files || files.length === 0) {
                alert("📂 This folder is empty.");
                return;
            }
    
            for (const file of files) {
                await handleFileSelect(file); // Recursively download each file (including subfolders if needed)
            }
        } catch (err) {
            console.error("Error listing folder contents:", err);
        }
    };

    return (
        <View style={{ marginTop: 100, padding: 20 }}>
            <Button
                title="Upload from Google Drive"
                disabled={!request}
                onPress={() => promptAsync()}
            />

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "#00000066",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            width: "90%",
                            maxHeight: "60%",
                            backgroundColor: "white",
                            borderRadius: 10,
                            padding: 20,
                        }}
                    >
                        <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
                            Your Google Drive Files
                        </Text>
                        <FlatList
                            data={driveFiles}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={
                                isFetchingMore ? <ActivityIndicator size="small" /> : null
                            }
                        />
                        <Button title="Close" onPress={() => setModalVisible(false)} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
