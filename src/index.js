import React from 'react';
import {Fragment, StrictMode} from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {createTheme, CssBaseline, GlobalStyles} from "@mui/material";
import * as PropTypes from "prop-types";
import {ThemeProvider} from "@emotion/react";
import {QueryClient, QueryClientProvider} from "react-query";
import AppBar from "./components/AppBar";
import Home from "./Home";
import Gallery from "./Gallery";
import Edit from "./Edit";

const inputGlobalStyles = <GlobalStyles /*styles={}*/ />;

const theme = createTheme({
    palette: {
        type: 'light',
        primary: {
            main: '#44b53f',
        },
        secondary: {
            main: '#00bef5',
        },
        info: {
            main: '#2196f3',
        },
    },
});

const queryClient = new QueryClient()

ReactDOM.render(
    <StrictMode>
        <Fragment>
            {inputGlobalStyles}
            {/*<CssBaseline/>*/}
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <Routes>
                            <Route pat="/" element={<App/>}>
                                <Route path="/" element={<Home/>}/>
                                <Route path="/:resolution" element={<Home/>}/>
                                <Route path="/gallery" element={<Gallery/>}/>
                                <Route path="/:resolution/gallery" element={<Gallery/>}/>
                                <Route path="/:resolution/edit/*" element={<Edit/>}/>
                                {/*<Route path="about" element={<About/>}/>*/}
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </QueryClientProvider>
            </ThemeProvider>
        </Fragment>
    </StrictMode>,
    document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
