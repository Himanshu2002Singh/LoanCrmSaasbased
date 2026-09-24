import React, { useState } from "react";
import API_URL from "../../config";
import axios from "axios";

const AddUserExcel = ({ handleCloseaddcallExcelModal }) => {
  const [currentFile, setCurrentFile] = useState(null);
  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    setCurrentFile(file);
  };
  const handleSubmit = async () => {
    if (!currentFile) {
      alert("Please select a file first!");
      return;
    }

    const formData = new FormData();
    formData.append("file", currentFile);

    try {
      const response = await axios.post(
        `${API_URL}/createuserusingexcel`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log(response.data);
      alert("Users created successfully!");
      handleCloseaddcallExcelModal();
    } catch (error) {
      console.log("Error uploading file:", error);
      // alert("Error creating users. Please try again.");
    }
  };

  return (
    <div className="max-w-md w-full mx-auto sm:max-w-xl lg:max-w-2xl">
      <div className="p-6 sm:p-8 rounded-2xl bg-white shadow">
        <div className="flex justify-between mb-4">
          <h2 className="text-gray-800 text-center text-xl sm:text-2xl font-bold">
            Add User
          </h2>
          <svg
            onClick={handleCloseaddcallExcelModal}
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 sm:w-5 sm:h-5 ml-2 cursor-pointer shrink-0 fill-gray-400 hover:fill-red-500"
            viewBox="0 0 320.591 320.591"
          >
            <path
              d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z"
              data-original="#000000"
            ></path>
            <path
              d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z"
              data-original="#000000"
            ></path>
          </svg>
        </div>

        <label htmlFor="uploadFile1">
          <div className="hover:cursor-pointer p-8 sm:p-12 border border-dashed rounded-lg border-customorange flex flex-col items-center justify-center">
            <svg
              fill="#000000"
              height="40px"
              width="40px"
              version="1.1"
              id="Layer_1"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              viewBox="0 0 512 512"
              xmlSpace="preserve"
            >
              <g>
                <g>
                  <g>
                    <path
                      d="M447.168,134.56c-0.535-1.288-1.318-2.459-2.304-3.445l-128-128c-2.003-1.988-4.709-3.107-7.531-3.115H74.667
				C68.776,0,64,4.776,64,10.667v490.667C64,507.224,68.776,512,74.667,512h362.667c5.891,0,10.667-4.776,10.667-10.667V138.667
				C447.997,137.256,447.714,135.86,447.168,134.56z M320,36.416L411.584,128H320V36.416z M426.667,490.667H85.333V21.333h213.333
				v117.333c0,5.891,4.776,10.667,10.667,10.667h117.333V490.667z"
                    />
                    <path
                      d="M128,181.333v256c0,5.891,4.776,10.667,10.667,10.667h234.667c5.891,0,10.667-4.776,10.667-10.667v-256
				c0-5.891-4.776-10.667-10.667-10.667H138.667C132.776,170.667,128,175.442,128,181.333z M320,192h42.667v42.667H320V192z
				 M320,256h42.667v42.667H320V256z M320,320h42.667v42.667H320V320z M320,384h42.667v42.667H320V384z M213.333,192h85.333v42.667
				h-85.333V192z M213.333,256h85.333v42.667h-85.333V256z M213.333,320h85.333v42.667h-85.333V320z M213.333,384h85.333v42.667
				h-85.333V384z M149.333,192H192v42.667h-42.667V192z M149.333,256H192v42.667h-42.667V256z M149.333,320H192v42.667h-42.667V320z
				 M149.333,384H192v42.667h-42.667V384z"
                    />
                  </g>
                </g>
              </g>
            </svg>
            <h3 className="text-customorange my-4">
              Browse & Upload Excel File
            </h3>
            <p>{currentFile?.name}</p>
            <input
              type="file"
              required
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              id="uploadFile1"
              className="hidden"
            />
          </div>
        </label>
        <div className="!mt-8">
          <button
            onClick={handleSubmit}
            type="button"
            className="w-full py-3 px-4 text-sm tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            Add
          </button>
        </div>
        {/* <p className="text-gray-800 text-sm !mt-8 text-center">
                Don't have an account?{" "}
                <a
                  href="javascript:void(0);"
                  className="text-blue-600 hover:underline ml-1 whitespace-nowrap font-semibold"
                >
                  Register here
                </a>
              </p> */}
      </div>
    </div>
  );
};

export default AddUserExcel;
