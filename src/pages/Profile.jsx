import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

import DashboardLayout from '../components/layout/DashboardLayout';

export default function Profile() {
    const { currentUser, userData, loading } = useAuth();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [gender, setGender] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    // Helper to compress image and convert to Base64
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300; // Resize to 300px width
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    useEffect(() => {
        if (userData) {
            setName(userData.name || '');
            setPhone(userData.phone || '');
            setGender(userData.gender || '');
            setPhotoPreview(userData.photoURL || null);
        }
    }, [userData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        setSaving(true);
        try {
            let photoURL = userData.photoURL || null;

            if (photo) {
                try {
                    console.log("Compressing and converting photo to Base64...");
                    photoURL = await compressImage(photo);
                    console.log("Photo processed successfully.");
                } catch (error) {
                    console.error("Error processing photo:", error);
                    alert("Failed to process photo. Please try another image.");
                    setSaving(false);
                    return;
                }
            }

            console.log("Updating Firestore document...");
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { name, phone, gender, photoURL });
            console.log("Firestore updated successfully.");
            alert('Profile updated successfully');
        } catch (err) {
            console.error('Error updating profile', err);
            alert('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    return (
        <DashboardLayout title="Edit Profile">
            <Card className="max-w-md mx-auto mt-8 p-6">
                <h2 className="text-2xl font-bold mb-4">Edit Profile</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col items-center mb-4">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-2">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    setPhoto(file);
                                    setPhotoPreview(URL.createObjectURL(file));
                                }
                            }}
                            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
                        <input
                            id="name"
                            type="text"
                            className="w-full border rounded px-3 py-2"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="phone">Phone</label>
                        <input
                            id="phone"
                            type="tel"
                            className="w-full border rounded px-3 py-2"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="gender">Gender</label>
                        <select
                            id="gender"
                            className="w-full border rounded px-3 py-2"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                        >
                            <option value="">Select gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <Button type="submit" disabled={saving} className="w-full">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </form>
            </Card>
        </DashboardLayout>
    );
}

