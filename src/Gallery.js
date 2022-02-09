import ky from "ky";
import {Checkbox, FormControlLabel, FormGroup, ImageList, ImageListItem, RadioGroup, Radio} from "@mui/material";
import useWindowSize from "./hooks/useWindowSize";
import {useQuery} from "react-query";
import {Link, useParams} from "react-router-dom";
import {useState} from "react";
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

function Gallery() {
    const params = useParams();
    const resolution = params.resolution ? params.resolution.split('x') : undefined;
    const thumb_width = 150;
    const cropped_thumb_height = resolution !== undefined ? resolution[1]/resolution[0]*thumb_width : undefined;
    const images = useQuery('homeImages', () =>
        ky.get(`/images?flat${resolution ? "&min_width=" + resolution[0] + "&min_height=" + resolution[1] : ""}`, {timeout: false}).json()
    );
    console.log("ZZXXCC", `/images?flat${resolution ? "&min_width=" + resolution[0] + "&min_height=" + resolution[1] : ""}`)
    const size = useWindowSize();
    const [view, setView] = useState('original');
    const handleViewChange = (event) => {
        setView(event.target.value);
    };
    return <div className="Gallery">
        <FormGroup>
            <RadioGroup
                aria-label="view"
                defaultValue="original"
                name="View"
                value={view}
                onChange={handleViewChange}
                row
            >
                <FormControlLabel value="original" control={<Radio/>} label="Original"/>
                <FormControlLabel value="uncropped" control={<Radio/>} label="Uncropped"/>
                <FormControlLabel value="cropped" control={<Radio/>} label="Cropped"/>
                <FormControlLabel value="crops" control={<Radio/>} label="Crops"/>
            </RadioGroup>
            {/*<FormControlLabel control={<Checkbox defaultChecked/>} label="Label"/>
                <FormControlLabel control={<Checkbox />} label="Disabled" />*/}
        </FormGroup>
        {images.isLoading ? <p>Loading...</p> : !images.error && <ImageList variant="masonry" cols={Math.floor(size.width / thumb_width)} gap={0}>
            {
                Object.keys(images.data).map(key => {
                    let i = 0;
                    switch (view) {
                        case 'cropped':
                        case 'uncropped':
                            if ((images.data[key].crops && view === 'uncropped') || (!images.data[key].crops && view === 'cropped')) {
                                return
                            }
                        case 'original':
                            return <ImageListItem key={key}>
                                <Link
                                    to={(resolution ? "/" + resolution[0] + "x" + resolution[1] : "") + "/" + key.replaceAll("%", "%25").replace("images", "edit")}>
                                    <LazyLoadImage
                                        src={"/" + key.replaceAll("%", "%25") + `.${images.data[key].format}?width=${thumb_width}`}
                                        style={{
                                            width: thumb_width,
                                            height: images.data[key].height * thumb_width / images.data[key].width
                                        }}
                                        width={thumb_width}
                                        height={images.data[key].height * thumb_width / images.data[key].width}
                                        effect="opacity"
                                    />
                                </Link>
                            </ImageListItem>
                        case 'crops':
                            if (!images.data[key].crops) {
                                return
                            }
                            console.log(images.data[key].crops);
                            return images.data[key].crops.map(crop => {
                                return <ImageListItem key={key + i++}>
                                    <Link
                                        to={(resolution ? "/" + resolution[0] + "x" + resolution[1] : "") + "/" + key.replaceAll("%", "%25").replace("images", "edit")}>
                                        <LazyLoadImage
                                            src={"/" + key.replaceAll("%", "%25") + `.${images.data[key].format}?width=${thumb_width}&crop_left=${crop.left}&crop_top=${crop.top}&crop_width=${crop.width}&crop_height=${crop.height}`}
                                            style={{
                                                width: thumb_width,
                                                height: cropped_thumb_height
                                            }}
                                            width={thumb_width}
                                            height={cropped_thumb_height}
                                            effect="opacity"
                                        />
                                    </Link>
                                </ImageListItem>
                            })
                    }
                })
            }
        </ImageList>}
    </div>;
}

export default Gallery;