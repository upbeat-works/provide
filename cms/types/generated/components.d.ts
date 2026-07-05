import type { Schema, Attribute } from '@strapi/strapi';

export interface AvoidingImpactsAvoidingImpacts extends Schema.Component {
  collectionName: 'components_avoiding_impacts_avoiding_impacts';
  info: {
    displayName: 'AvoidingImpacts';
    icon: 'allergies';
    description: '';
  };
  attributes: {
    IndicatorUid: Attribute.String;
    StudyLocationUid: Attribute.String;
    Description: Attribute.RichText;
    GeographyUid: Attribute.String;
    ExplorerUrl: Attribute.String;
  };
}

export interface DataProcessingDataProcessing extends Schema.Component {
  collectionName: 'components_data_processing_data_processings';
  info: {
    displayName: 'DataProcessing';
    icon: 'bars';
  };
  attributes: {
    Title: Attribute.String;
    Label: Attribute.String;
    Description: Attribute.RichText;
  };
}

export interface FutureImpactsFutureImpacts extends Schema.Component {
  collectionName: 'components_future_impacts_future_impacts';
  info: {
    displayName: 'FutureImpacts';
    icon: 'asterisk';
    description: '';
  };
  attributes: {
    ImpactTimeSnapshot: Attribute.Component<
      'future-impacts.impact-time-snapshot',
      true
    >;
    ImpactGeoSnapshot: Attribute.Component<'future-impacts.impact-geo', true>;
    ImpactTimeDescription: Attribute.RichText;
    ImpactGeoDescription: Attribute.RichText;
    ExplorerUrl: Attribute.String;
  };
}

export interface FutureImpactsImpactGeo extends Schema.Component {
  collectionName: 'components_impacts_galery_impact_geos';
  info: {
    displayName: 'ImpactGeoSnapshot';
    icon: 'map';
    description: '';
  };
  attributes: {
    Indicator: Attribute.String;
    Year: Attribute.String;
    Image: Attribute.Media;
  };
}

export interface FutureImpactsImpactTimeSnapshot extends Schema.Component {
  collectionName: 'components_impacts_galery_impact_time_snapshots';
  info: {
    displayName: 'ImpactTimeSnapshot';
    icon: 'chart-line';
    description: '';
  };
  attributes: {
    Indicator: Attribute.String;
    Image: Attribute.Media;
  };
}

export interface ImageSliderImageSliderPair extends Schema.Component {
  collectionName: 'components_image_slider_image_slider_pairs';
  info: {
    displayName: 'ImageSliderPair';
    icon: 'object-ungroup';
    description: '';
  };
  attributes: {
    Image1: Attribute.Media & Attribute.Required;
    Image2: Attribute.Media;
    AttributeValue: Attribute.String;
    GroupName: Attribute.String;
  };
}

export interface ImageSliderImageSlider extends Schema.Component {
  collectionName: 'components_image_slider_image_sliders';
  info: {
    displayName: 'ImageSlider';
    icon: 'images';
    description: '';
  };
  attributes: {
    Description: Attribute.RichText;
    AttributeLabel: Attribute.String;
    ImageSliderPair: Attribute.Component<
      'image-slider.image-slider-pair',
      true
    >;
    GroupingLabel: Attribute.String;
    ExplorerUrl: Attribute.String;
  };
}

export interface IssueIssue extends Schema.Component {
  collectionName: 'components_issue_issues';
  info: {
    displayName: 'Issue';
    icon: 'tasks';
    description: '';
  };
  attributes: {
    Title: Attribute.String;
    Description: Attribute.RichText;
  };
}

export interface MediaPublication extends Schema.Component {
  collectionName: 'components_media_publications';
  info: {
    displayName: 'Publication';
    icon: 'file-contract';
  };
  attributes: {
    PublicationDate: Attribute.Date;
    Type: Attribute.Enumeration<['publication', 'deliverable']> &
      Attribute.DefaultTo<'publication'>;
    File: Attribute.Media;
  };
}

export interface MethodologyDataTypeDataType extends Schema.Component {
  collectionName: 'components_methodology_data_type_data_types';
  info: {
    displayName: 'Data Type';
    icon: 'apps';
    description: '';
  };
  attributes: {
    Label: Attribute.String;
    Model: Attribute.Component<'methodology-model.model', true>;
    Simulation: Attribute.Component<'methodology-simulation.simulation', true>;
    Processing: Attribute.Component<'methodology-processing.processing', true>;
  };
}

export interface MethodologyModelModel extends Schema.Component {
  collectionName: 'components_methodology_model_models';
  info: {
    displayName: 'Model';
    icon: 'connector';
    description: '';
  };
  attributes: {
    Label: Attribute.String;
    Description: Attribute.RichText;
    TitleShort: Attribute.String;
  };
}

export interface MethodologyProcessingProcessing extends Schema.Component {
  collectionName: 'components_methodology_processing_processings';
  info: {
    displayName: 'Processing';
    icon: 'cog';
    description: '';
  };
  attributes: {
    Label: Attribute.String;
    Description: Attribute.RichText;
    TitleShort: Attribute.String;
  };
}

export interface MethodologySimulationSimulation extends Schema.Component {
  collectionName: 'components_methodology_simulation_simulations';
  info: {
    displayName: 'Simulation';
    icon: 'connector';
    description: '';
  };
  attributes: {
    Label: Attribute.String;
    Description: Attribute.RichText;
    TitleShort: Attribute.String;
  };
}

export interface ModelModel extends Schema.Component {
  collectionName: 'components_model_models';
  info: {
    displayName: 'Model';
    icon: 'align-left';
    description: '';
  };
  attributes: {
    Title: Attribute.String;
    Description: Attribute.RichText;
    Link: Attribute.String;
    Label: Attribute.String;
    UID: Attribute.String;
  };
}

export interface ScenarioCharacteristicScenarioCharacteristic
  extends Schema.Component {
  collectionName: 'components_scenario_characteristic_scenario_characteristics';
  info: {
    displayName: 'ScenarioCharacteristic';
    icon: 'barcode';
    description: '';
  };
  attributes: {
    Description: Attribute.Text;
    Year: Attribute.String;
  };
}

export interface ScenarioUidScenario extends Schema.Component {
  collectionName: 'components_scenario_uid_scenarios';
  info: {
    displayName: 'Scenario';
    icon: 'align-right';
  };
  attributes: {
    UID: Attribute.String;
  };
}

export interface ScenarioScenario extends Schema.Component {
  collectionName: 'components_scenario_scenarios';
  info: {
    displayName: 'Scenario';
    icon: 'align-justify';
    description: '';
  };
  attributes: {
    Title: Attribute.String;
    Description: Attribute.RichText;
    Label: Attribute.String;
    UID: Attribute.String;
  };
}

export interface SectionSection extends Schema.Component {
  collectionName: 'components_section_sections';
  info: {
    displayName: 'Section';
    icon: 'align-center';
    description: '';
  };
  attributes: {
    Title: Attribute.String;
    Text: Attribute.RichText;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'avoiding-impacts.avoiding-impacts': AvoidingImpactsAvoidingImpacts;
      'data-processing.data-processing': DataProcessingDataProcessing;
      'future-impacts.future-impacts': FutureImpactsFutureImpacts;
      'future-impacts.impact-geo': FutureImpactsImpactGeo;
      'future-impacts.impact-time-snapshot': FutureImpactsImpactTimeSnapshot;
      'image-slider.image-slider-pair': ImageSliderImageSliderPair;
      'image-slider.image-slider': ImageSliderImageSlider;
      'issue.issue': IssueIssue;
      'media.publication': MediaPublication;
      'methodology-data-type.data-type': MethodologyDataTypeDataType;
      'methodology-model.model': MethodologyModelModel;
      'methodology-processing.processing': MethodologyProcessingProcessing;
      'methodology-simulation.simulation': MethodologySimulationSimulation;
      'model.model': ModelModel;
      'scenario-characteristic.scenario-characteristic': ScenarioCharacteristicScenarioCharacteristic;
      'scenario-uid.scenario': ScenarioUidScenario;
      'scenario.scenario': ScenarioScenario;
      'section.section': SectionSection;
    }
  }
}
