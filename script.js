document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const originalPreview = document.getElementById('originalPreview');
    const compressedPreview = document.getElementById('compressedPreview');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const compressionRatio = document.getElementById('compressionRatio');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    const downloadBtn = document.getElementById('downloadBtn');
    const uploadLabel = document.querySelector('.upload-label');
    const comparisonContainer = document.querySelector('.comparison-container');

    // 添加错误提示元素
    const errorToast = document.createElement('div');
    errorToast.className = 'error-toast';
    document.body.appendChild(errorToast);

    // 当前处理的文件
    let currentFile = null;

    // 监听文件选择
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });

    // 处理图片上传
    function handleImageUpload(file) {
        currentFile = file;
        
        // 显示对比区域
        comparisonContainer.style.display = 'flex';
        
        // 显示原图
        const originalUrl = URL.createObjectURL(file);
        originalPreview.src = originalUrl;
        originalSize.textContent = formatFileSize(file.size);
        
        // 开始压缩
        const quality = qualitySlider.value / 100;
        compressImage(file, quality);
    }

    // 监听拖拽
    uploadLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadLabel.classList.add('dragover');
    });

    uploadLabel.addEventListener('dragleave', () => {
        uploadLabel.classList.remove('dragover');
    });

    uploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadLabel.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        } else {
            showToast('请上传图片文件');
        }
    });

    // 质量滑块事件
    qualitySlider.addEventListener('input', (e) => {
        const quality = e.target.value;
        qualityValue.textContent = `质量: ${quality}%`;
        
        if (currentFile) {
            clearTimeout(qualitySlider.timeout);
            qualitySlider.timeout = setTimeout(() => {
                compressImage(currentFile, quality / 100);
            }, 200);
        }
    });

    // 图片压缩函数
    async function compressImage(file, quality) {
        try {
            // 当质量为100%时，使用原图
            if (quality >= 1) {
                handleOriginalImage(file);
                return;
            }

            const img = await createImageFromFile(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 设置canvas尺寸
            canvas.width = img.width;
            canvas.height = img.height;

            // 优化绘制质量
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, img.width, img.height);

            // 根据文件类型和大小选择压缩策略
            const sizeMB = file.size / (1024 * 1024);
            let finalQuality = quality;
            let format = file.type;

            // 对大文件进行额外的尺寸调整
            if (sizeMB > 2) {
                const scale = Math.min(1, Math.sqrt(2 / sizeMB));
                canvas.width = Math.floor(img.width * scale);
                canvas.height = Math.floor(img.height * scale);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            // 对PNG格式特殊处理
            if (file.type === 'image/png') {
                const jpegBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', finalQuality);
                });
                const pngBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });

                if (jpegBlob.size < pngBlob.size && jpegBlob.size < file.size) {
                    format = 'image/jpeg';
                }
            }

            // 使用选定的格式进行最终压缩
            const compressedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, format, format === 'image/jpeg' ? finalQuality : undefined);
            });

            // 如果压缩失败或压缩后变大，使用原图
            if (!compressedBlob || compressedBlob.size >= file.size) {
                showToast('压缩后文件较大，已保持原图质量');
                handleOriginalImage(file);
                return;
            }

            const compressedUrl = URL.createObjectURL(compressedBlob);
            
            // 更新预览
            compressedPreview.src = compressedUrl;
            compressedSize.textContent = formatFileSize(compressedBlob.size);

            // 计算压缩率
            const ratio = ((file.size - compressedBlob.size) / file.size * 100).toFixed(1);
            compressionRatio.textContent = `节省空间: ${ratio}%`;

            // 更新下载按钮
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = compressedUrl;
                const extension = format === 'image/jpeg' ? '.jpg' : '.png';
                const fileName = file.name.replace(/\.[^/.]+$/, '_compressed' + extension);
                link.download = fileName;
                link.click();
                setTimeout(() => URL.revokeObjectURL(compressedUrl), 100);
            };

        } catch (error) {
            console.error('压缩失败:', error);
            showToast('图片处理失败，已保持原图质量');
            handleOriginalImage(file);
        }
    }

    // 处理原图显示
    function handleOriginalImage(file) {
        const originalUrl = URL.createObjectURL(file);
        compressedPreview.src = originalUrl;
        compressedSize.textContent = formatFileSize(file.size);
        compressionRatio.textContent = "原图质量";
        
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = originalUrl;
            link.download = file.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(originalUrl), 100);
        };
    }

    // 显示提示信息
    function showToast(message) {
        errorToast.textContent = message;
        errorToast.classList.add('show');
        setTimeout(() => {
            errorToast.classList.remove('show');
        }, 3000);
    }

    // 创建图片对象
    function createImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图片加载失败'));
            };
            
            img.src = url;
        });
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}); 