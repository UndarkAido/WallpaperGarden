import {useParams, useSearchParams} from "react-router-dom";
import {useQuery, useQueryClient} from "react-query";
import ky from "ky";
import Cropper from "react-easy-crop";
import {useCallback, useRef, useState} from "react";
import useWindowSize from "./hooks/useWindowSize";
import {Button, hexToRgb} from "@mui/material";

function Edit() {
    const size = useWindowSize();
    const queryClient = useQueryClient()
    const [imageScale, setImageScale] = useState(0);
    const [crop, setCrop] = useState({x: 0, y: 0});
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(1);
    const params = useParams();
    const path = params["*"];
    const resolution = params.resolution.split('x');
    let [searchParams, setSearchParams] = useSearchParams();
    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        //console.log(croppedArea, croppedAreaPixels);
        setCroppedAreaPixels(croppedAreaPixels);
    }, [])
    const info = useQuery('info', () =>
        ky.get(`/images/${path}?info&width=${resolution[0]}&height=${resolution[1]}`).json()
    );
    if (info.isLoading) {
        return <p>Loading</p>
    } else if (info.error) {
        return <p>Image does not exist</p>
    } else if (info.data.width < resolution[0] || info.data.height < resolution[1]) {
        return <p>This image is too small for your screen</p>
    }
    console.log(JSON.stringify(info.data));
    console.log(`/images/${path}?info&width=${resolution[0]}&height=${resolution[1]}`);
    const min_dim = 200;
    let cropper_width, cropper_height, scale;
    if (false) {
        const diag_dim = Math.sqrt(info.data.width * info.data.width + info.data.height * info.data.height);
        scale = Math.min(size.width / diag_dim, (size.height - 75 - 400) / diag_dim, 1);
        let cropper_diag = diag_dim * scale;
        if (cropper_diag < min_dim) {
            scale = min_dim / diag_dim;
            cropper_diag = diag_dim * scale;
        }
        cropper_width = cropper_diag;
        cropper_height = cropper_diag;
    } else {
        scale = Math.min(size.width / info.data.width, (size.height - 75 - 400) / info.data.height, 1);
        cropper_width = info.data.width * scale;
        cropper_height = info.data.height * scale;
        if (cropper_width < min_dim) {
            scale = min_dim / info.data.width;
            cropper_width = info.data.width * scale;
            cropper_height = info.data.height * scale;
        }
        if (cropper_height < min_dim) {
            scale = min_dim / info.data.height;
            cropper_width = info.data.width * scale;
            cropper_height = info.data.height * scale;
        }
    }
    /*if (ready) {
        cropper.zoomTo(scale);
    }*/
    if (scale > imageScale) {
        setImageScale(1.5 * scale);
    }
    return <div className="Home">
        <div style={{position: "relative", width: cropper_width, height: cropper_height}}>
            <Cropper
                image={`/images/${path}`}
                crop={crop}
                zoom={zoom}
                aspect={resolution[0] / resolution[1]}
                maxZoom={Math.min(info.data.width / resolution[0], info.data.height / resolution[1])}
                zoomSpeed={.01}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                objectFit={resolution[0] / resolution[1] > 1 ? "horizontal-cover" : "vertical-cover"}
            />
        </div>
        {/*<img src={`/images/${path}`}/>*/}
        {/*<Cropper
            src={`/images/${path}`}//?width=${imageScale*info.data.width}&height=${imageScale*info.data.height}`}
            style={{height: cropper_height, width: cropper_width}}
            // Cropper.js options
            viewMode={1}
            aspectRatio={resolution[0] / resolution[1]}
            minCropBoxWidth={resolution[0] * scale}
            minCropBoxHeight={resolution[1] * scale}
            guides={true}
            modal={true}
            //minCanvasHeight={cropper_height}
            //minCanvasWidth={cropper_width}
            scalable={false}
            zoomable={false}
            movable={false}
            responsive={true}
            crop={onCrop}
            ref={cropperRef}
            checkOrientation={false} // https://github.com/fengyuanchen/cropperjs/issues/671
            onInitialized={(instance) => {
                setCropper(instance);
            }}
            ready={event => {
                setReady(true);
            }}
        />*/}
        <Button variant="contained" onClick={() => {
            ky.post(`/images/${path}?width=${resolution[0]}&height=${resolution[1]}&crop_left=${croppedAreaPixels.x}&crop_top=${croppedAreaPixels.y}&crop_width=${croppedAreaPixels.width}&crop_height=${croppedAreaPixels.height}`)
                .then(async () => {
                    await queryClient.invalidateQueries('info');
                });
        }}>Save Crop</Button>
        {<p>{JSON.stringify(croppedAreaPixels)}</p>}
        {/*croppedAreaPixels && <img
            src={`/images/${path}?width=${resolution[0]}&height=${resolution[1]}&crop_left=${croppedAreaPixels.x}&crop_top=${croppedAreaPixels.y}&crop_width=${croppedAreaPixels.width}&crop_height=${croppedAreaPixels.height}`}
            style={{width: cropper_width}}
        />*/}
        {
            info.data.crops && info.data.crops.map(crop => {
                let url = `/images/${path}?width=${resolution[0]}&height=${resolution[1]}&crop_left=${crop.left}&crop_top=${crop.top}&crop_width=${crop.width}&crop_height=${crop.height}`;
                console.log("YYY", url);
                return <img
                    src={url}
                    alt={url}
                    style={{
                        width: cropper_width,
                        height: resolution[1] / resolution[0] * cropper_width
                    }}
                />
            })
        }
    </div>;
}

export default Edit;