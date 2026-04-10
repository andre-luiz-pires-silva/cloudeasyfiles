import { StorageTierSelector, type StorageTierSelectorContent } from "./StorageTierSelector";
import { type AwsUploadStorageClass } from "../awsUploadStorageClasses";
export type AwsStorageClassSelectorContent = StorageTierSelectorContent<AwsUploadStorageClass>;

type AwsStorageClassSelectorProps = {
  value: AwsUploadStorageClass | null;
  onChange: (value: AwsUploadStorageClass) => void;
  content: AwsStorageClassSelectorContent;
  name?: string;
  allowedOptions?: AwsUploadStorageClass[];
};

export function AwsStorageClassSelector({
  value,
  onChange,
  content,
  name = "aws-storage-class",
  allowedOptions
}: AwsStorageClassSelectorProps) {
  return (
    <StorageTierSelector
      value={value}
      onChange={onChange}
      content={{
        ...content,
        providerCodeLabel: content.providerCodeLabel
      }}
      name={name}
      allowedOptions={allowedOptions}
    />
  );
}
