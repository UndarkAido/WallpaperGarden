import {useParams, useSearchParams} from "react-router-dom";
import {useQuery} from "react-query";
import ky from "ky";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import {useRef, useState} from "react";
import useWindowSize from "./hooks/useWindowSize";
import {Button, hexToRgb} from "@mui/material";

function Edit() {
    const size = useWindowSize();
    const [imageScale, setImageScale] = useState(0);
    let cropperRef = useRef(null);
    const params = useParams();
    const path = params["*"];
    const resolution = params.resolution.split('x');
    console.log(resolution);
    const [cropper, setCropper] = useState();
    const [ready, setReady] = useState(false);
    let [searchParams, setSearchParams] = useSearchParams();
    const {isLoading: infoLoading, error: infoError, data: info} = useQuery('homeImages', () =>
        ky.get(`/images/${path}?info`).json()
    );
    const onCrop = () => {
        const imageElement = cropperRef?.current;
        const cropper = imageElement?.cropper;
        //console.log(cropper.getCroppedCanvas().toDataURL());
        console.log("onCrop", cropper.getData());
    };
    if (infoLoading) {
        return <p>Loading</p>
    } else if (infoError) {
        return <p>Image does not exist</p>
    } else if (info.width < resolution[0] || info.height < resolution[1]) {
        return <p>This image is too small for your screen</p>
    }
    const min_dim = 200;
    let cropper_width, cropper_height, scale;
    if (false) {
        const diag_dim = Math.sqrt(info.width * info.width + info.height * info.height);
        scale = Math.min(size.width / diag_dim, (size.height - 75 - 400) / diag_dim, 1);
        let cropper_diag = diag_dim * scale;
        if (cropper_diag < min_dim) {
            scale = min_dim / diag_dim;
            cropper_diag = diag_dim * scale;
        }
        cropper_width = cropper_diag;
        cropper_height = cropper_diag;
    } else {
        scale = Math.min(size.width / info.width, (size.height - 75 - 400) / info.height, 1);
        cropper_width = info.width * scale;
        cropper_height = info.height * scale;
        if (cropper_width < min_dim) {
            scale = min_dim / info.width;
            cropper_width = info.width * scale;
            cropper_height = info.height * scale;
        }
        if (cropper_height < min_dim) {
            scale = min_dim / info.height;
            cropper_width = info.width * scale;
            cropper_height = info.height * scale;
        }
    }
    if (ready) {
        cropper.zoomTo(scale);
    }
    if(scale > imageScale){
        setImageScale(1.5*scale);
    }
    return <div className="Home">
        {/*<img src={`/images/${path}`}/>*/}
        <Cropper
            src={`/images/${path}`/*?width=${imageScale*info.width}&height=${imageScale*info.height}`*/}
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
        />
        {ready && <p>{JSON.stringify(cropper.getData())}</p>}
    </div>;
}

export default Edit;