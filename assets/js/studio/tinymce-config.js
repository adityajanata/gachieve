// The one TinyMCE setup every edit page uses (PRD 5.7). Self-hosted, no API key.
const BASE_URL = 'assets/js/vendor/tinymce';

const TOOLBAR = 'blocks | bold italic underline strikethrough | forecolor backcolor | bullist numlist blockquote | link gaimage gacode | code';

const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';

function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The writing area reads like the published tutorial, in the active theme. */
function contentStyle() {
    return `
        body { margin: 16px; background: ${token('--surface-solid')}; color: ${token('--text')}; font: 400 15px/24px Poppins, sans-serif; }
        a { color: ${token('--accent')}; }
        img { max-width: 100%; height: auto; border-radius: ${token('--radius-card')}; }
        blockquote { margin: 16px 0; padding-left: 16px; border-left: 3px solid ${token('--accent')}; }
    `;
}

function addCustomButtons(editor, uploadImage) {
    editor.ui.registry.addToggleButton('gacode', {
        icon: 'code-sample',
        tooltip: 'Inline code',
        onAction: () => editor.execCommand('mceToggleFormat', false, 'code'),
        onSetup: (api) => {
            const handler = editor.formatter.formatChanged('code', (active) => api.setActive(active));
            return () => handler.unbind();
        },
    });
    // Paste and drag cover most images. This is the path for phones and for files already on disk.
    editor.ui.registry.addButton('gaimage', {
        icon: 'image',
        tooltip: 'Insert image',
        onAction: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = ACCEPTED_IMAGES;
            input.addEventListener('change', async () => {
                const [file] = input.files;
                if (!file) return;
                try {
                    const location = await uploadImage(file, file.name);
                    editor.insertContent(editor.dom.createHTML('img', { src: location, alt: '' }));
                } catch {
                    // uploadImage has already told the user.
                }
            });
            input.click();
        },
    });
}

/** Resolves to the editor. onChange runs on every edit; uploadImage(blob, name) resolves to the image's location. */
export async function createEditor({ target, onChange, uploadImage }) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const [editor] = await window.tinymce.init({
        target,
        base_url: new URL(BASE_URL, document.baseURI).href,
        suffix: '.min',
        license_key: 'gpl',
        promotion: false,
        branding: false,
        menubar: false,
        statusbar: false,
        height: 420,
        plugins: 'lists link autolink code',
        toolbar: TOOLBAR,
        toolbar_mode: 'wrap',
        block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4; Code block=pre',
        skin: dark ? 'oxide-dark' : 'oxide',
        content_css: [dark ? 'dark' : 'default', 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap'],
        content_style: contentStyle(),
        document_base_url: document.baseURI,
        relative_urls: false,
        convert_urls: false,
        link_assume_external_targets: 'https',
        paste_data_images: true,
        automatic_uploads: true,
        images_file_types: 'jpeg,jpg,png,webp,gif',
        images_upload_handler: (blobInfo) => uploadImage(blobInfo.blob(), blobInfo.filename()),
        setup: (instance) => {
            addCustomButtons(instance, uploadImage);
            instance.on('input change undo redo', onChange);
        },
    });
    return editor;
}
