import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { FileCard } from './ui';
import { PublicPage } from './Public';
import { Setup, StaffArea } from './Staff';

export function App() {
    return <FileCard lang="ar" dir="rtl">
        <Routes>
            <Route path="/" element={<PublicPage />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/staff/*" element={<StaffArea />} />
            <Route path="*" element={<PublicPage />} />
        </Routes>
    </FileCard>;
}
